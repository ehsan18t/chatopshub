import type { RawBodyRequest } from "@nestjs/common";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiExcludeEndpoint, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import type { DbService } from "@/db/db.service";
import { channels } from "@/db/schema/index";
import type { MessengerWebhookPayload, WhatsAppWebhookPayload } from "./dto/index";
import type { WebhooksService } from "./webhooks.service";

@ApiTags("Webhooks")
@Controller("webhooks")
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly dbService: DbService,
  ) {}

  // ============================================================
  // WhatsApp Webhooks
  // ============================================================

  @Get("whatsapp/:channelId")
  @ApiOperation({ summary: "WhatsApp webhook verification" })
  @ApiResponse({ status: 200, description: "Returns the challenge" })
  async verifyWhatsApp(
    @Param("channelId") channelId: string,
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") verifyToken: string,
    @Query("hub.challenge") challenge: string,
  ): Promise<string> {
    this.logger.log(`WhatsApp webhook verification for channel ${channelId}`);

    if (mode !== "subscribe") {
      throw new BadRequestException("Invalid mode");
    }

    // Verify token matches channel's webhook secret
    const [channel] = await this.dbService.db
      .select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!channel) {
      throw new BadRequestException("Channel not found");
    }

    if (channel.webhookSecret !== verifyToken) {
      throw new UnauthorizedException("Invalid verify token");
    }

    this.logger.log(`WhatsApp webhook verified for channel ${channelId}`);
    return challenge;
  }

  @Post("whatsapp/:channelId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "WhatsApp webhook receiver" })
  @ApiResponse({ status: 200, description: "Webhook processed" })
  async handleWhatsApp(
    @Param("channelId") channelId: string,
    @Headers("x-hub-signature-256") signature: string,
    @Req() req: RawBodyRequest<Request>,
    @Body() body: WhatsAppWebhookPayload,
  ): Promise<{ status: string }> {
    this.logger.log(`WhatsApp webhook received for channel ${channelId}`);

    // Get channel
    const [channel] = await this.dbService.db
      .select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!channel) {
      throw new BadRequestException("Channel not found");
    }

    // Validate signature if app secret is configured
    const config = channel.config as { appSecret?: string };
    if (config.appSecret && signature) {
      const rawBody = req.rawBody?.toString() ?? JSON.stringify(body);
      const isValid = this.webhooksService.validateWhatsAppSignature(
        rawBody,
        signature,
        config.appSecret,
      );

      if (!isValid) {
        this.logger.warn(`Invalid WhatsApp signature for channel ${channelId}`);
        throw new UnauthorizedException("Invalid signature");
      }
    }

    // Process webhook asynchronously (in production, use queue)
    // For now, process synchronously
    try {
      await this.webhooksService.processWhatsAppWebhook(body);
    } catch (error) {
      this.logger.error(`Error processing WhatsApp webhook: ${error}`);
      // Still return 200 to prevent retries for non-recoverable errors
    }

    return { status: "ok" };
  }

  // ============================================================
  // Messenger Webhooks
  // ============================================================

  @Get("messenger/:channelId")
  @ApiOperation({ summary: "Messenger webhook verification" })
  @ApiResponse({ status: 200, description: "Returns the challenge" })
  async verifyMessenger(
    @Param("channelId") channelId: string,
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") verifyToken: string,
    @Query("hub.challenge") challenge: string,
  ): Promise<string> {
    this.logger.log(`Messenger webhook verification for channel ${channelId}`);

    if (mode !== "subscribe") {
      throw new BadRequestException("Invalid mode");
    }

    // Verify token matches channel's webhook secret
    const [channel] = await this.dbService.db
      .select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!channel) {
      throw new BadRequestException("Channel not found");
    }

    if (channel.webhookSecret !== verifyToken) {
      throw new UnauthorizedException("Invalid verify token");
    }

    this.logger.log(`Messenger webhook verified for channel ${channelId}`);
    return challenge;
  }

  @Post("messenger/:channelId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Messenger webhook receiver" })
  @ApiResponse({ status: 200, description: "Webhook processed" })
  async handleMessenger(
    @Param("channelId") channelId: string,
    @Headers("x-hub-signature-256") signature: string,
    @Req() req: RawBodyRequest<Request>,
    @Body() body: MessengerWebhookPayload,
  ): Promise<{ status: string }> {
    this.logger.log(`Messenger webhook received for channel ${channelId}`);

    // Get channel
    const [channel] = await this.dbService.db
      .select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!channel) {
      throw new BadRequestException("Channel not found");
    }

    // Validate signature if app secret is configured
    const config = channel.config as { appSecret?: string };
    if (config.appSecret && signature) {
      const rawBody = req.rawBody?.toString() ?? JSON.stringify(body);
      const isValid = this.webhooksService.validateMessengerSignature(
        rawBody,
        signature,
        config.appSecret,
      );

      if (!isValid) {
        this.logger.warn(`Invalid Messenger signature for channel ${channelId}`);
        throw new UnauthorizedException("Invalid signature");
      }
    }

    // Process webhook asynchronously (in production, use queue)
    try {
      await this.webhooksService.processMessengerWebhook(body);
    } catch (error) {
      this.logger.error(`Error processing Messenger webhook: ${error}`);
      // Still return 200 to prevent retries
    }

    return { status: "ok" };
  }

  // ============================================================
  // Generic Webhook (for testing/development)
  // ============================================================

  @Post("test")
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleTestWebhook(@Body() body: unknown): Promise<{ received: boolean; body: unknown }> {
    this.logger.log("Test webhook received");
    return { received: true, body };
  }
}
