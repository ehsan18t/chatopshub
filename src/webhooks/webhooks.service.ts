import * as crypto from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { ContactsService } from "../contacts/contacts.service";
import type { ConversationsService } from "../conversations/conversations.service";
import type { DbService } from "../db/db.service";
import { channels } from "../db/schema/index";
import type { MessagesService } from "../messages/messages.service";
import type {
  MessengerMessaging,
  MessengerWebhookPayload,
  WhatsAppMessage,
  WhatsAppStatus,
  WhatsAppWebhookPayload,
} from "./dto/index";

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly dbService: DbService,
    private readonly contactsService: ContactsService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
  ) {}

  // ============================================================
  // Signature Validation
  // ============================================================

  validateWhatsAppSignature(payload: string, signature: string, appSecret: string): boolean {
    if (!signature.startsWith("sha256=")) {
      return false;
    }

    const expectedHash = crypto.createHmac("sha256", appSecret).update(payload).digest("hex");

    const providedHash = signature.slice(7); // Remove 'sha256=' prefix

    return crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(providedHash));
  }

  validateMessengerSignature(payload: string, signature: string, appSecret: string): boolean {
    if (!signature.startsWith("sha256=")) {
      return false;
    }

    const expectedHash = crypto.createHmac("sha256", appSecret).update(payload).digest("hex");

    const providedHash = signature.slice(7);

    return crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(providedHash));
  }

  // ============================================================
  // WhatsApp Webhook Processing
  // ============================================================

  async processWhatsAppWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
    this.logger.log("Processing WhatsApp webhook");

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const value = change.value;
        const phoneNumberId = value.metadata.phone_number_id;

        // Find channel by phone number ID
        const matchingChannel = await this.findWhatsAppChannel(phoneNumberId);
        if (!matchingChannel) {
          this.logger.warn(`No channel found for phone number ID: ${phoneNumberId}`);
          continue;
        }

        // Process messages
        if (value.messages && value.contacts) {
          for (const message of value.messages) {
            const contact = value.contacts.find((c) => c.wa_id === message.from);
            await this.handleWhatsAppMessage(
              matchingChannel,
              message,
              contact?.profile.name ?? message.from,
            );
          }
        }

        // Process status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            await this.handleWhatsAppStatus(status);
          }
        }
      }
    }
  }

  private async findWhatsAppChannel(phoneNumberId: string) {
    const allChannels = await this.dbService.db
      .select()
      .from(channels)
      .where(eq(channels.provider, "WHATSAPP"));

    for (const ch of allChannels) {
      const config = ch.config as { phoneNumberId?: string };
      if (config.phoneNumberId === phoneNumberId) {
        return ch;
      }
    }
    return null;
  }

  private async handleWhatsAppMessage(
    channel: typeof channels.$inferSelect,
    message: WhatsAppMessage,
    displayName: string,
  ): Promise<void> {
    this.logger.log(`Processing WhatsApp message ${message.id} from ${message.from}`);

    // Upsert contact
    const contact = await this.contactsService.upsert(
      channel.organizationId,
      "WHATSAPP",
      message.from,
      displayName,
    );

    // Find or create conversation
    const conversation = await this.conversationsService.findOrCreate(
      channel.organizationId,
      channel.id,
      contact.id,
    );

    // Reopen if completed
    if (conversation.status === "COMPLETED") {
      await this.conversationsService.reopen(conversation.id);
    }

    // Extract message content
    let body = "";
    let mediaUrl: string | undefined;
    let mediaType: string | undefined;

    switch (message.type) {
      case "text":
        body = message.text?.body ?? "";
        break;
      case "image":
        mediaType = "image";
        mediaUrl = message.image?.id; // Will be resolved to URL by provider service
        body = message.image?.caption ?? "[Image]";
        break;
      case "audio":
        mediaType = "audio";
        mediaUrl = message.audio?.id;
        body = "[Audio]";
        break;
      case "video":
        mediaType = "video";
        mediaUrl = message.video?.id;
        body = message.video?.caption ?? "[Video]";
        break;
      case "document":
        mediaType = "document";
        mediaUrl = message.document?.id;
        body = message.document?.filename ?? "[Document]";
        break;
      case "location":
        mediaType = "location";
        body = message.location?.name ?? "[Location]";
        break;
      default:
        body = `[${message.type}]`;
    }

    // Create message
    await this.messagesService.create(
      conversation.id,
      "INBOUND",
      { body, mediaUrl, mediaType },
      undefined,
      message.id,
    );

    // Update conversation lastMessageAt
    await this.conversationsService.updateLastMessageAt(conversation.id);

    this.logger.log(`WhatsApp message ${message.id} processed successfully`);
  }

  private async handleWhatsAppStatus(status: WhatsAppStatus): Promise<void> {
    this.logger.log(`Processing WhatsApp status ${status.status} for message ${status.id}`);

    switch (status.status) {
      case "sent":
        await this.messagesService.updateStatus(status.id, "SENT");
        break;
      case "delivered":
        await this.messagesService.markDelivered(status.id);
        break;
      case "read":
        await this.messagesService.markRead(status.id);
        break;
      case "failed":
        await this.messagesService.updateStatus(status.id, "FAILED");
        break;
    }
  }

  // ============================================================
  // Messenger Webhook Processing
  // ============================================================

  async processMessengerWebhook(payload: MessengerWebhookPayload): Promise<void> {
    this.logger.log("Processing Messenger webhook");

    for (const entry of payload.entry) {
      const pageId = entry.id;

      // Find channel by page ID
      const channel = await this.findMessengerChannel(pageId);
      if (!channel) {
        this.logger.warn(`No channel found for page ID: ${pageId}`);
        continue;
      }

      for (const messaging of entry.messaging) {
        if (messaging.message) {
          await this.handleMessengerMessage(channel, messaging);
        } else if (messaging.delivery) {
          await this.handleMessengerDelivery(messaging);
        } else if (messaging.read) {
          await this.handleMessengerRead(messaging);
        }
      }
    }
  }

  private async findMessengerChannel(pageId: string) {
    const allChannels = await this.dbService.db
      .select()
      .from(channels)
      .where(eq(channels.provider, "MESSENGER"));

    for (const ch of allChannels) {
      const config = ch.config as { pageId?: string };
      if (config.pageId === pageId) {
        return ch;
      }
    }
    return null;
  }

  private async handleMessengerMessage(
    channel: typeof channels.$inferSelect,
    messaging: MessengerMessaging,
  ): Promise<void> {
    const senderId = messaging.sender.id;
    const message = messaging.message;

    if (!message) {
      this.logger.warn("Messenger messaging event has no message");
      return;
    }

    this.logger.log(`Processing Messenger message ${message.mid} from ${senderId}`);

    // Upsert contact (we'll get profile info separately if needed)
    const contact = await this.contactsService.upsert(
      channel.organizationId,
      "MESSENGER",
      senderId,
      `User ${senderId.slice(-6)}`, // Placeholder until profile fetch
    );

    // Find or create conversation
    const conversation = await this.conversationsService.findOrCreate(
      channel.organizationId,
      channel.id,
      contact.id,
    );

    // Reopen if completed
    if (conversation.status === "COMPLETED") {
      await this.conversationsService.reopen(conversation.id);
    }

    // Extract message content
    let body = "";
    let mediaUrl: string | undefined;
    let mediaType: string | undefined;

    if (message.text) {
      body = message.text;
    } else if (message.attachments && message.attachments.length > 0) {
      const attachment = message.attachments[0];
      switch (attachment.type) {
        case "image":
          mediaType = "image";
          mediaUrl = attachment.payload.url;
          body = "[Image]";
          break;
        case "audio":
          mediaType = "audio";
          mediaUrl = attachment.payload.url;
          body = "[Audio]";
          break;
        case "video":
          mediaType = "video";
          mediaUrl = attachment.payload.url;
          body = "[Video]";
          break;
        case "file":
          mediaType = "document";
          mediaUrl = attachment.payload.url;
          body = "[File]";
          break;
        case "location":
          mediaType = "location";
          body = "[Location]";
          break;
        default:
          body = `[${attachment.type}]`;
      }
    }

    // Create message
    await this.messagesService.create(
      conversation.id,
      "INBOUND",
      { body, mediaUrl, mediaType },
      undefined,
      message.mid,
    );

    // Update conversation lastMessageAt
    await this.conversationsService.updateLastMessageAt(conversation.id);

    this.logger.log(`Messenger message ${message.mid} processed successfully`);
  }

  private async handleMessengerDelivery(messaging: MessengerMessaging): Promise<void> {
    const delivery = messaging.delivery;

    if (!delivery) {
      this.logger.warn("Messenger messaging event has no delivery info");
      return;
    }

    for (const mid of delivery.mids) {
      this.logger.log(`Processing Messenger delivery for message ${mid}`);
      await this.messagesService.markDelivered(mid);
    }
  }

  private async handleMessengerRead(messaging: MessengerMessaging): Promise<void> {
    // Messenger read receipts use watermarks, not individual message IDs
    // For now, we'll log it - in production, we'd track watermarks per conversation
    this.logger.log(`Messenger read receipt received with watermark ${messaging.read?.watermark}`);
  }
}
