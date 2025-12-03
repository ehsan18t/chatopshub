import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import Redis from "iovalkey";

@Injectable()
export class ValkeyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ValkeyService.name);
  private client!: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const valkeyUrl = this.configService.get<string>("VALKEY_URL");

    if (!valkeyUrl) {
      throw new Error("VALKEY_URL is not defined");
    }

    this.client = new Redis(valkeyUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      lazyConnect: false,
    });

    this.client.on("error", (err: Error) => {
      this.logger.error("Valkey connection error:", err);
    });

    this.client.on("connect", () => {
      this.logger.log("Valkey connection established");
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log("Valkey connection closed");
  }

  getClient(): Redis {
    return this.client;
  }

  // Lock helpers for distributed operations
  async acquireLock(key: string, ttlMs: number, value = "locked"): Promise<boolean> {
    const result = await this.client.set(key, value, "PX", ttlMs, "NX");
    return result === "OK";
  }

  async releaseLock(key: string): Promise<void> {
    await this.client.del(key);
  }

  // Session storage helpers (for better-auth)
  async setSession(sessionId: string, data: object, ttlSeconds: number): Promise<void> {
    await this.client.setex(`session:${sessionId}`, ttlSeconds, JSON.stringify(data));
  }

  async getSession(sessionId: string): Promise<object | null> {
    const data = await this.client.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.del(`session:${sessionId}`);
  }

  // Pub/Sub for WebSocket broadcasting
  async publish(channel: string, message: object): Promise<void> {
    await this.client.publish(channel, JSON.stringify(message));
  }

  createSubscriber(): Redis {
    return this.client.duplicate();
  }

  // Generic cache helpers
  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
    } else {
      await this.client.set(key, JSON.stringify(value));
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  // Increment/decrement for counters
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async decr(key: string): Promise<number> {
    return this.client.decr(key);
  }

  // Expire key
  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }
}
