import { Module } from "@nestjs/common";
import { MessengerService } from "./messenger.service";
import { WhatsAppService } from "./whatsapp.service";

@Module({
  providers: [WhatsAppService, MessengerService],
  exports: [WhatsAppService, MessengerService],
})
export class ProvidersModule {}
