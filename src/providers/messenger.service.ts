import { Injectable, Logger } from "@nestjs/common";
import type { channels } from "@/db/schema/index";

export interface MessengerSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface MessengerConfig {
  pageId: string;
  pageAccessToken: string;
  appSecret?: string;
}

export interface MessengerTextOptions {
  recipientId: string;
  text: string;
  quickReplies?: Array<{
    content_type: "text";
    title: string;
    payload: string;
  }>;
}

export interface MessengerMediaOptions {
  recipientId: string;
  mediaType: "image" | "audio" | "video" | "file";
  mediaUrl: string;
  isReusable?: boolean;
}

export interface MessengerTemplateOptions {
  recipientId: string;
  templateType: "button" | "generic";
  elements: unknown[];
}

@Injectable()
export class MessengerService {
  private readonly logger = new Logger(MessengerService.name);
  private readonly apiVersion = "v21.0";
  private readonly baseUrl = "https://graph.facebook.com";

  async sendTextMessage(
    channel: typeof channels.$inferSelect,
    options: MessengerTextOptions,
  ): Promise<MessengerSendResult> {
    const config = channel.config as MessengerConfig;
    const url = `${this.baseUrl}/${this.apiVersion}/me/messages`;

    const payload: Record<string, unknown> = {
      recipient: { id: options.recipientId },
      messaging_type: "RESPONSE",
      message: {
        text: options.text,
      },
    };

    if (options.quickReplies && options.quickReplies.length > 0) {
      (payload.message as Record<string, unknown>).quick_replies = options.quickReplies;
    }

    return this.sendRequest(url, config.pageAccessToken, payload);
  }

  async sendMediaMessage(
    channel: typeof channels.$inferSelect,
    options: MessengerMediaOptions,
  ): Promise<MessengerSendResult> {
    const config = channel.config as MessengerConfig;
    const url = `${this.baseUrl}/${this.apiVersion}/me/messages`;

    const payload: Record<string, unknown> = {
      recipient: { id: options.recipientId },
      messaging_type: "RESPONSE",
      message: {
        attachment: {
          type: options.mediaType,
          payload: {
            url: options.mediaUrl,
            is_reusable: options.isReusable ?? false,
          },
        },
      },
    };

    return this.sendRequest(url, config.pageAccessToken, payload);
  }

  async sendTemplateMessage(
    channel: typeof channels.$inferSelect,
    options: MessengerTemplateOptions,
  ): Promise<MessengerSendResult> {
    const config = channel.config as MessengerConfig;
    const url = `${this.baseUrl}/${this.apiVersion}/me/messages`;

    const payload: Record<string, unknown> = {
      recipient: { id: options.recipientId },
      messaging_type: "RESPONSE",
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: options.templateType,
            elements: options.elements,
          },
        },
      },
    };

    return this.sendRequest(url, config.pageAccessToken, payload);
  }

  async sendButtonTemplate(
    channel: typeof channels.$inferSelect,
    recipientId: string,
    text: string,
    buttons: Array<{
      type: "postback" | "web_url";
      title: string;
      payload?: string;
      url?: string;
    }>,
  ): Promise<MessengerSendResult> {
    const config = channel.config as MessengerConfig;
    const url = `${this.baseUrl}/${this.apiVersion}/me/messages`;

    const payload: Record<string, unknown> = {
      recipient: { id: recipientId },
      messaging_type: "RESPONSE",
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text,
            buttons,
          },
        },
      },
    };

    return this.sendRequest(url, config.pageAccessToken, payload);
  }

  async markMessageAsSeen(
    channel: typeof channels.$inferSelect,
    recipientId: string,
  ): Promise<boolean> {
    const config = channel.config as MessengerConfig;
    const url = `${this.baseUrl}/${this.apiVersion}/me/messages`;

    const payload = {
      recipient: { id: recipientId },
      sender_action: "mark_seen",
    };

    const result = await this.sendRequest(url, config.pageAccessToken, payload);
    return result.success;
  }

  async sendTypingIndicator(
    channel: typeof channels.$inferSelect,
    recipientId: string,
    typing: boolean,
  ): Promise<boolean> {
    const config = channel.config as MessengerConfig;
    const url = `${this.baseUrl}/${this.apiVersion}/me/messages`;

    const payload = {
      recipient: { id: recipientId },
      sender_action: typing ? "typing_on" : "typing_off",
    };

    const result = await this.sendRequest(url, config.pageAccessToken, payload);
    return result.success;
  }

  async getUserProfile(
    channel: typeof channels.$inferSelect,
    userId: string,
  ): Promise<{ firstName?: string; lastName?: string; profilePic?: string } | null> {
    const config = channel.config as MessengerConfig;
    const url = `${this.baseUrl}/${this.apiVersion}/${userId}?fields=first_name,last_name,profile_pic&access_token=${config.pageAccessToken}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        this.logger.error(`Failed to get user profile: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as {
        first_name?: string;
        last_name?: string;
        profile_pic?: string;
      };

      return {
        firstName: data.first_name,
        lastName: data.last_name,
        profilePic: data.profile_pic,
      };
    } catch (error) {
      this.logger.error(`Error getting user profile: ${error}`);
      return null;
    }
  }

  async getPageInfo(channel: typeof channels.$inferSelect): Promise<unknown | null> {
    const config = channel.config as MessengerConfig;
    const url = `${this.baseUrl}/${this.apiVersion}/me?fields=id,name,picture&access_token=${config.pageAccessToken}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        this.logger.error(`Failed to get page info: ${response.status}`);
        return null;
      }

      return response.json();
    } catch (error) {
      this.logger.error(`Error getting page info: ${error}`);
      return null;
    }
  }

  async testConnection(
    channel: typeof channels.$inferSelect,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const pageInfo = await this.getPageInfo(channel);
      return { success: pageInfo !== null };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async sendRequest(
    url: string,
    accessToken: string,
    payload: Record<string, unknown>,
  ): Promise<MessengerSendResult> {
    try {
      this.logger.debug(`Sending Messenger message: ${JSON.stringify(payload)}`);

      const response = await fetch(`${url}?access_token=${accessToken}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        message_id?: string;
        recipient_id?: string;
        error?: { code: number; message: string };
      };

      if (!response.ok) {
        this.logger.error(`Messenger API error: ${JSON.stringify(data)}`);
        return {
          success: false,
          error: {
            code: data.error?.code?.toString() ?? "UNKNOWN",
            message: data.error?.message ?? "Unknown error",
          },
        };
      }

      this.logger.log(`Messenger message sent: ${data.message_id}`);

      return {
        success: true,
        providerMessageId: data.message_id,
      };
    } catch (error) {
      this.logger.error(`Messenger send error: ${error}`);
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
