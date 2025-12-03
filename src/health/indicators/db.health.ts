import { Injectable } from "@nestjs/common";
import type { HealthIndicatorService, HealthIndicatorResult } from "@nestjs/terminus";
import { sql } from "drizzle-orm";
import type { DbService } from "@/db/db.service";

@Injectable()
export class DbHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly dbService: DbService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      await this.dbService.db.execute(sql`SELECT 1`);
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: (error as Error).message });
    }
  }
}
