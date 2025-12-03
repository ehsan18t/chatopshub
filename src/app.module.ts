import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { ChannelsModule } from "./channels/channels.module";
import { ConfigModule } from "./config/config.module";
import { ContactsModule } from "./contacts/contacts.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { DbModule } from "./db/db.module";
import { EventsModule } from "./events/events.module";
import { HealthModule } from "./health/health.module";
import { MessagesModule } from "./messages/messages.module";
import { ProvidersModule } from "./providers/providers.module";
import { QueuesModule } from "./queues/queues.module";
import { StorageModule } from "./storage/storage.module";
import { UsersModule } from "./users/users.module";
import { ValkeyModule } from "./valkey/valkey.module";
import { WebhooksModule } from "./webhooks/webhooks.module";

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRoot([
      {
        name: "short",
        ttl: 1000,
        limit: 3,
      },
      {
        name: "medium",
        ttl: 10000,
        limit: 20,
      },
      {
        name: "long",
        ttl: 60000,
        limit: 100,
      },
    ]),
    DbModule,
    ValkeyModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ChannelsModule,
    ContactsModule,
    ConversationsModule,
    MessagesModule,
    WebhooksModule,
    ProvidersModule,
    EventsModule,
    QueuesModule,
    AnalyticsModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
