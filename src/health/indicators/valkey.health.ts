import { Injectable } from "@nestjs/common";
import type { HealthIndicatorResult, HealthIndicatorService } from "@nestjs/terminus";
import type { ValkeyService } from "@/valkey/valkey.service";

@Injectable()
export class ValkeyHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly valkeyService: ValkeyService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      const client = this.valkeyService.getClient();
      const result = await client.ping();

      if (result === "PONG") {
        return indicator.up();
      }

      return indicator.down({ message: `Unexpected ping response: ${result}` });
    } catch (error) {
      return indicator.down({ message: (error as Error).message });
    }
  }
}
