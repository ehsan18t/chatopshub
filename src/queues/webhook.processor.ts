import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import type { MessengerWebhookPayload, WhatsAppWebhookPayload } from "../webhooks/dto/index";
import type { WebhooksService } from "../webhooks/webhooks.service";

export interface WebhookJobData {
  type: "whatsapp" | "messenger";
  channelId: string;
  payload: WhatsAppWebhookPayload | MessengerWebhookPayload;
  receivedAt: string;
}

@Processor("webhooks")
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private readonly webhooksService: WebhooksService) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    const { type, channelId, payload, receivedAt } = job.data;

    this.logger.log(
      `Processing ${type} webhook for channel ${channelId} (received: ${receivedAt})`,
    );

    try {
      if (type === "whatsapp") {
        await this.webhooksService.processWhatsAppWebhook(payload as WhatsAppWebhookPayload);
      } else if (type === "messenger") {
        await this.webhooksService.processMessengerWebhook(payload as MessengerWebhookPayload);
      }

      this.logger.log(`Webhook processed successfully (job: ${job.id})`);
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error}`, (error as Error).stack);
      throw error; // Let BullMQ handle retry
    }
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job): void {
    this.logger.debug(`Webhook job ${job.id} completed`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(`Webhook job ${job?.id} failed: ${error.message}`);
  }
}
