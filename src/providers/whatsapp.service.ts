import { Injectable, Logger } from "@nestjs/common";
import type { channels } from "../db/schema/index";

export interface SendMessageResult {
  success: boolean;
  providerMessageId?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId?: string;
}

export interface SendTextMessageOptions {
  to: string;
  body: string;
  replyToMessageId?: string;
}

export interface SendMediaMessageOptions {
  to: string;
  mediaType: "image" | "audio" | "video" | "document";
  mediaUrl?: string;
  mediaId?: string;
  caption?: string;
  filename?: string;
}

export interface SendLocationMessageOptions {
  to: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly apiVersion = "v21.0";
  private readonly baseUrl = "https://graph.facebook.com";

  async sendTextMessage(
    channel: typeof channels.$inferSelect,
    options: SendTextMessageOptions,
  ): Promise<SendMessageResult> {
    const config = channel.config as WhatsAppConfig;
    const url = `${this.baseUrl}/${this.apiVersion}/${config.phoneNumberId}/messages`;

    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: options.to,
      type: "text",
      text: {
        preview_url: false,
        body: options.body,
      },
    };

    if (options.replyToMessageId) {
      payload.context = { message_id: options.replyToMessageId };
    }

    return this.sendRequest(url, config.accessToken, payload);
  }

  async sendMediaMessage(
    channel: typeof channels.$inferSelect,
    options: SendMediaMessageOptions,
  ): Promise<SendMessageResult> {
    const config = channel.config as WhatsAppConfig;
    const url = `${this.baseUrl}/${this.apiVersion}/${config.phoneNumberId}/messages`;

    const mediaPayload: Record<string, unknown> = {};

    if (options.mediaId) {
      mediaPayload.id = options.mediaId;
    } else if (options.mediaUrl) {
      mediaPayload.link = options.mediaUrl;
    }

    if (options.caption) {
      mediaPayload.caption = options.caption;
    }

    if (options.filename && options.mediaType === "document") {
      mediaPayload.filename = options.filename;
    }

    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: options.to,
      type: options.mediaType,
      [options.mediaType]: mediaPayload,
    };

    return this.sendRequest(url, config.accessToken, payload);
  }

  async sendLocationMessage(
    channel: typeof channels.$inferSelect,
    options: SendLocationMessageOptions,
  ): Promise<SendMessageResult> {
    const config = channel.config as WhatsAppConfig;
    const url = `${this.baseUrl}/${this.apiVersion}/${config.phoneNumberId}/messages`;

    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: options.to,
      type: "location",
      location: {
        latitude: options.latitude,
        longitude: options.longitude,
        name: options.name,
        address: options.address,
      },
    };

    return this.sendRequest(url, config.accessToken, payload);
  }

  async downloadMedia(
    channel: typeof channels.$inferSelect,
    mediaId: string,
  ): Promise<Buffer | null> {
    const config = channel.config as WhatsAppConfig;

    try {
      // First, get the media URL
      const mediaInfoUrl = `${this.baseUrl}/${this.apiVersion}/${mediaId}`;
      const mediaInfoResponse = await fetch(mediaInfoUrl, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
      });

      if (!mediaInfoResponse.ok) {
        this.logger.error(`Failed to get media info: ${mediaInfoResponse.status}`);
        return null;
      }

      const mediaInfo = (await mediaInfoResponse.json()) as { url?: string };
      if (!mediaInfo.url) {
        this.logger.error("No URL in media info response");
        return null;
      }

      // Download the actual media
      const mediaResponse = await fetch(mediaInfo.url, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
      });

      if (!mediaResponse.ok) {
        this.logger.error(`Failed to download media: ${mediaResponse.status}`);
        return null;
      }

      const arrayBuffer = await mediaResponse.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.logger.error(`Error downloading media: ${error}`);
      return null;
    }
  }

  async markMessageAsRead(
    channel: typeof channels.$inferSelect,
    messageId: string,
  ): Promise<boolean> {
    const config = channel.config as WhatsAppConfig;
    const url = `${this.baseUrl}/${this.apiVersion}/${config.phoneNumberId}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    };

    const result = await this.sendRequest(url, config.accessToken, payload);
    return result.success;
  }

  async getBusinessProfile(channel: typeof channels.$inferSelect): Promise<unknown | null> {
    const config = channel.config as WhatsAppConfig;
    const url = `${this.baseUrl}/${this.apiVersion}/${config.phoneNumberId}/whatsapp_business_profile`;

    try {
      const response = await fetch(
        `${url}?fields=about,address,description,email,profile_picture_url,websites,vertical`,
        {
          headers: { Authorization: `Bearer ${config.accessToken}` },
        },
      );

      if (!response.ok) {
        this.logger.error(`Failed to get business profile: ${response.status}`);
        return null;
      }

      return response.json();
    } catch (error) {
      this.logger.error(`Error getting business profile: ${error}`);
      return null;
    }
  }

  async testConnection(
    channel: typeof channels.$inferSelect,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const profile = await this.getBusinessProfile(channel);
      return { success: profile !== null };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async sendRequest(
    url: string,
    accessToken: string,
    payload: Record<string, unknown>,
  ): Promise<SendMessageResult> {
    try {
      this.logger.debug(`Sending WhatsApp message: ${JSON.stringify(payload)}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        messages?: Array<{ id: string }>;
        error?: { code: number; message: string };
      };

      if (!response.ok) {
        this.logger.error(`WhatsApp API error: ${JSON.stringify(data)}`);
        return {
          success: false,
          error: {
            code: data.error?.code?.toString() ?? "UNKNOWN",
            message: data.error?.message ?? "Unknown error",
          },
        };
      }

      const messageId = data.messages?.[0]?.id;
      this.logger.log(`WhatsApp message sent: ${messageId}`);

      return {
        success: true,
        providerMessageId: messageId,
      };
    } catch (error) {
      this.logger.error(`WhatsApp send error: ${error}`);
      return {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: String(error),
        },
      };
    }
  }
}
