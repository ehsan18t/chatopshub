import { forwardRef, Module } from "@nestjs/common";
import { ConversationsModule } from "@/conversations/conversations.module";
import { ValkeyModule } from "@/valkey/valkey.module";
import { EventsGateway } from "./events.gateway";

@Module({
  imports: [ValkeyModule, forwardRef(() => ConversationsModule)],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
