import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { DbService } from "../db/db.service";
import { type Channel, channels, type NewChannel } from "../db/schema/index";
import type { CreateChannelDto, UpdateChannelDto } from "./dto/index";

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(private readonly dbService: DbService) {}

  async create(organizationId: string, dto: CreateChannelDto): Promise<Channel> {
    const newChannel: NewChannel = {
      organizationId,
      provider: dto.provider,
      name: dto.name,
      config: dto.config,
      webhookSecret: dto.webhookSecret,
      status: "ACTIVE",
    };

    const [channel] = await this.dbService.db.insert(channels).values(newChannel).returning();

    this.logger.log(`Channel created: ${channel.id} (${dto.provider})`);
    return channel;
  }

  async findAll(organizationId: string, limit = 100): Promise<Channel[]> {
    return this.dbService.db
      .select()
      .from(channels)
      .where(eq(channels.organizationId, organizationId))
      .limit(limit);
  }

  async findById(id: string): Promise<Channel | null> {
    const [channel] = await this.dbService.db
      .select()
      .from(channels)
      .where(eq(channels.id, id))
      .limit(1);

    return channel ?? null;
  }

  async findByIdOrFail(id: string): Promise<Channel> {
    const channel = await this.findById(id);
    if (!channel) {
      throw new NotFoundException("Channel not found");
    }
    return channel;
  }

  async findByProvider(
    organizationId: string,
    provider: "WHATSAPP" | "MESSENGER",
    limit = 100,
  ): Promise<Channel[]> {
    return this.dbService.db
      .select()
      .from(channels)
      .where(and(eq(channels.organizationId, organizationId), eq(channels.provider, provider)))
      .limit(limit);
  }

  async findActiveByProvider(
    organizationId: string,
    provider: "WHATSAPP" | "MESSENGER",
    limit = 100,
  ): Promise<Channel[]> {
    return this.dbService.db
      .select()
      .from(channels)
      .where(
        and(
          eq(channels.organizationId, organizationId),
          eq(channels.provider, provider),
          eq(channels.status, "ACTIVE"),
        ),
      )
      .limit(limit);
  }

  async update(id: string, dto: UpdateChannelDto): Promise<Channel> {
    await this.findByIdOrFail(id);

    const [updated] = await this.dbService.db
      .update(channels)
      .set({
        ...dto,
      })
      .where(eq(channels.id, id))
      .returning();

    this.logger.log(`Channel updated: ${id}`);
    return updated;
  }

  async updateStatus(id: string, status: "ACTIVE" | "INACTIVE" | "ERROR"): Promise<Channel> {
    await this.findByIdOrFail(id);

    const [updated] = await this.dbService.db
      .update(channels)
      .set({ status })
      .where(eq(channels.id, id))
      .returning();

    this.logger.log(`Channel status updated: ${id} -> ${status}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.findByIdOrFail(id);
    await this.dbService.db.delete(channels).where(eq(channels.id, id));
    this.logger.log(`Channel deleted: ${id}`);
  }

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    const channel = await this.findByIdOrFail(id);

    // TODO: Implement actual connection testing to WhatsApp/Messenger APIs
    // This is a placeholder that always returns success
    this.logger.log(`Testing connection for channel: ${id} (${channel.provider})`);

    return {
      success: true,
      message: `Connection to ${channel.provider} successful`,
    };
  }
}
