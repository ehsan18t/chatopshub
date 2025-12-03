import { BullModule } from "@nestjs/bullmq";
import { forwardRef, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventsModule } from "@/events/events.module";
import { MessagesModule } from "@/messages/messages.module";
import { ProvidersModule } from "@/providers/providers.module";
import { WebhooksModule } from "@/webhooks/webhooks.module";
import { OutboundMessageProcessor } from "./outbound-message.processor";
import { QueuesService } from "./queues.service";
import { WebhookProcessor } from "./webhook.processor";

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>("VALKEY_URL"),
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
    }),
    BullModule.registerQueue({ name: "webhooks" }, { name: "outbound-messages" }),
    forwardRef(() => WebhooksModule),
    ProvidersModule,
    forwardRef(() => MessagesModule),
    forwardRef(() => EventsModule),
  ],
  providers: [QueuesService, WebhookProcessor, OutboundMessageProcessor],
  exports: [QueuesService, BullModule],
})
export class QueuesModule {}
