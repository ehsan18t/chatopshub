import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { DbModule } from "@/db/db.module";
import { ValkeyModule } from "@/valkey/valkey.module";
import { HealthController } from "./health.controller";
import { DbHealthIndicator } from "./indicators/db.health";
import { ValkeyHealthIndicator } from "./indicators/valkey.health";

@Module({
  imports: [TerminusModule, DbModule, ValkeyModule],
  controllers: [HealthController],
  providers: [DbHealthIndicator, ValkeyHealthIndicator],
})
export class HealthModule {}
