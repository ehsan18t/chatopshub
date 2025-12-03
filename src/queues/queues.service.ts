import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Queue } from "bullmq";
import type { OutboundMessageJobData } from "./outbound-message.processor";
import type { WebhookJobData } from "./webhook.processor";

@Injectable()
export class QueuesService {
  private readonly logger = new Logger(QueuesService.name);

  constructor(
    @InjectQueue("webhooks") private readonly webhooksQueue: Queue<WebhookJobData>,
    @InjectQueue("outbound-messages") private readonly outboundQueue: Queue<OutboundMessageJobData>,
  ) {}

  async queueWebhook(data: WebhookJobData): Promise<void> {
    const job = await this.webhooksQueue.add("process", data, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: 1000, // Keep last 1000 completed jobs
      removeOnFail: 5000, // Keep last 5000 failed jobs for debugging
    });

    this.logger.log(`Webhook queued (job: ${job.id})`);
  }

  async queueOutboundMessage(data: OutboundMessageJobData): Promise<void> {
    const job = await this.outboundQueue.add("send", data, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });

    this.logger.log(`Outbound message queued (job: ${job.id}, message: ${data.messageId})`);
  }

  async getWebhookQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.webhooksQueue.getWaitingCount(),
      this.webhooksQueue.getActiveCount(),
      this.webhooksQueue.getCompletedCount(),
      this.webhooksQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  async getOutboundQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.outboundQueue.getWaitingCount(),
      this.outboundQueue.getActiveCount(),
      this.outboundQueue.getCompletedCount(),
      this.outboundQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  async retryFailedWebhooks(): Promise<number> {
    const failed = await this.webhooksQueue.getFailed();
    let retried = 0;

    for (const job of failed) {
      await job.retry();
      retried++;
    }

    return retried;
  }

  async retryFailedOutbound(): Promise<number> {
    const failed = await this.outboundQueue.getFailed();
    let retried = 0;

    for (const job of failed) {
      await job.retry();
      retried++;
    }

    return retried;
  }
}
