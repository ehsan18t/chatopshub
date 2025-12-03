import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import type { DbService } from "@/db/db.service";
import { channels, contacts, conversations, messages } from "@/db/schema/index";
import { type EventsGateway, ServerEvent } from "@/events/events.gateway";
import type { MessagesService } from "@/messages/messages.service";
import type { MessengerService } from "@/providers/messenger.service";
import type { WhatsAppService } from "@/providers/whatsapp.service";

export interface OutboundMessageJobData {
  messageId: string;
  conversationId: string;
  channelId: string;
  contactId: string;
  body: string;
  mediaUrl?: string;
  mediaType?: string;
  agentId?: string;
}

@Processor("outbound-messages")
export class OutboundMessageProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboundMessageProcessor.name);

  constructor(
    private readonly dbService: DbService,
    private readonly whatsappService: WhatsAppService,
    private readonly messengerService: MessengerService,
    private readonly messagesService: MessagesService,
    private readonly eventsGateway: EventsGateway,
  ) {
    super();
  }

  async process(job: Job<OutboundMessageJobData>): Promise<void> {
    const { messageId, conversationId, channelId, contactId, body, mediaUrl, mediaType } = job.data;

    this.logger.log(`Processing outbound message ${messageId}`);

    try {
      // Get channel
      const [channel] = await this.dbService.db
        .select()
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      // Get contact
      const [contact] = await this.dbService.db
        .select()
        .from(contacts)
        .where(eq(contacts.id, contactId))
        .limit(1);

      if (!contact) {
        throw new Error(`Contact not found: ${contactId}`);
      }

      // Get conversation for organization info
      const [conversation] = await this.dbService.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      // Send message based on provider
      let result: {
        success: boolean;
        providerMessageId?: string;
        error?: { code: string; message: string };
      };

      if (channel.provider === "WHATSAPP") {
        if (mediaUrl && mediaType) {
          result = await this.whatsappService.sendMediaMessage(channel, {
            to: contact.providerId,
            mediaType: mediaType as "image" | "audio" | "video" | "document",
            mediaUrl,
            caption: body || undefined,
          });
        } else {
          result = await this.whatsappService.sendTextMessage(channel, {
            to: contact.providerId,
            body,
          });
        }
      } else if (channel.provider === "MESSENGER") {
        if (mediaUrl && mediaType) {
          result = await this.messengerService.sendMediaMessage(channel, {
            recipientId: contact.providerId,
            mediaType: mediaType as "image" | "audio" | "video" | "file",
            mediaUrl,
          });
        } else {
          result = await this.messengerService.sendTextMessage(channel, {
            recipientId: contact.providerId,
            text: body,
          });
        }
      } else {
        throw new Error(`Unsupported provider: ${channel.provider}`);
      }

      // Update message status
      if (result.success) {
        // Update message with provider message ID
        await this.dbService.db
          .update(messages)
          .set({
            providerMessageId: result.providerMessageId,
            status: "SENT",
          })
          .where(eq(messages.id, messageId));

        // Notify via WebSocket
        this.eventsGateway.emitToConversation(conversationId, ServerEvent.MESSAGE_UPDATED, {
          messageId,
          status: "SENT",
          providerMessageId: result.providerMessageId,
        });

        this.logger.log(
          `Message ${messageId} sent successfully (provider ID: ${result.providerMessageId})`,
        );
      } else {
        // Mark as failed
        await this.messagesService.updateStatus(
          messageId,
          "FAILED",
          result.error?.code,
          result.error?.message,
        );

        // Notify via WebSocket
        this.eventsGateway.emitToConversation(conversationId, ServerEvent.MESSAGE_UPDATED, {
          messageId,
          status: "FAILED",
          error: result.error,
        });

        throw new Error(`Failed to send message: ${result.error?.message}`);
      }
    } catch (error) {
      this.logger.error(`Error sending outbound message ${messageId}: ${error}`);
      throw error;
    }
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job): void {
    this.logger.debug(`Outbound message job ${job.id} completed`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(`Outbound message job ${job?.id} failed: ${error.message}`);
  }
}
