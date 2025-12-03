import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { DbService } from "../db/db.service";
import { type Contact, contacts, type NewContact } from "../db/schema/index";

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly dbService: DbService) {}

  async upsert(
    organizationId: string,
    provider: "WHATSAPP" | "MESSENGER",
    providerId: string,
    displayName?: string,
    metadata?: Record<string, unknown>,
  ): Promise<Contact> {
    // Check if contact already exists
    const existing = await this.findByProviderId(organizationId, provider, providerId);

    if (existing) {
      // Update last seen and optionally displayName
      const updates: Partial<Contact> = {
        lastSeenAt: new Date(),
      };

      if (displayName && !existing.displayName) {
        updates.displayName = displayName;
      }

      if (metadata) {
        updates.metadata = { ...(existing.metadata as Record<string, unknown>), ...metadata };
      }

      const [updated] = await this.dbService.db
        .update(contacts)
        .set(updates)
        .where(eq(contacts.id, existing.id))
        .returning();

      return updated;
    }

    // Create new contact
    const newContact: NewContact = {
      organizationId,
      providerId,
      provider,
      displayName,
      metadata,
    };

    const [contact] = await this.dbService.db.insert(contacts).values(newContact).returning();

    this.logger.log(`Contact created: ${contact.id} (${provider}: ${providerId})`);
    return contact;
  }

  async findByProviderId(
    organizationId: string,
    provider: "WHATSAPP" | "MESSENGER",
    providerId: string,
  ): Promise<Contact | null> {
    const [contact] = await this.dbService.db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.organizationId, organizationId),
          eq(contacts.provider, provider),
          eq(contacts.providerId, providerId),
        ),
      )
      .limit(1);

    return contact ?? null;
  }

  async findById(id: string): Promise<Contact | null> {
    const [contact] = await this.dbService.db
      .select()
      .from(contacts)
      .where(eq(contacts.id, id))
      .limit(1);

    return contact ?? null;
  }

  async findByIdOrFail(id: string): Promise<Contact> {
    const contact = await this.findById(id);
    if (!contact) {
      throw new NotFoundException("Contact not found");
    }
    return contact;
  }

  async findAll(organizationId: string, limit = 100): Promise<Contact[]> {
    return this.dbService.db
      .select()
      .from(contacts)
      .where(eq(contacts.organizationId, organizationId))
      .limit(limit);
  }

  async updateLastSeen(id: string): Promise<void> {
    await this.dbService.db
      .update(contacts)
      .set({ lastSeenAt: new Date() })
      .where(eq(contacts.id, id));
  }

  async update(
    id: string,
    displayName?: string,
    metadata?: Record<string, unknown>,
  ): Promise<Contact> {
    const existing = await this.findByIdOrFail(id);

    const updates: Partial<Contact> = {};

    if (displayName !== undefined) {
      updates.displayName = displayName;
    }

    if (metadata !== undefined) {
      updates.metadata = { ...(existing.metadata as Record<string, unknown>), ...metadata };
    }

    const [updated] = await this.dbService.db
      .update(contacts)
      .set(updates)
      .where(eq(contacts.id, id))
      .returning();

    this.logger.log(`Contact updated: ${id}`);
    return updated;
  }
}
