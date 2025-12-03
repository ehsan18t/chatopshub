import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  type HealthCheckResult,
} from "@nestjs/terminus";
import { DbHealthIndicator } from "./indicators/db.health";
import { ValkeyHealthIndicator } from "./indicators/valkey.health";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly db: DbHealthIndicator,
    private readonly valkey: ValkeyHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: "Check application health" })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      // Database health
      () => this.db.isHealthy("database"),

      // Valkey/Redis health
      () => this.valkey.isHealthy("valkey"),

      // Memory health (heap should be less than 200MB)
      () => this.memory.checkHeap("memory_heap", 200 * 1024 * 1024),

      // RSS memory (should be less than 500MB)
      () => this.memory.checkRSS("memory_rss", 500 * 1024 * 1024),
    ]);
  }

  @Get("liveness")
  @ApiOperation({ summary: "Kubernetes liveness probe" })
  liveness(): { status: string } {
    return { status: "ok" };
  }

  @Get("readiness")
  @HealthCheck()
  @ApiOperation({ summary: "Kubernetes readiness probe" })
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.isHealthy("database"),
      () => this.valkey.isHealthy("valkey"),
    ]);
  }
}
