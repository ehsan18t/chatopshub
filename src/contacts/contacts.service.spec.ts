import { NotFoundException } from "@nestjs/common";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { DbService } from "../db/db.service";
import { ContactsService } from "./contacts.service";

const mockContact = {
  id: "contact-1",
  organizationId: "org-1",
  providerId: "123456789",
  provider: "WHATSAPP" as const,
  displayName: "Test Contact",
  metadata: {},
  firstSeenAt: new Date(),
  lastSeenAt: new Date(),
};

describe("ContactsService", () => {
  let service: ContactsService;
  let mockDbService: DbService;

  beforeEach(() => {
    mockDbService = {
      db: {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockContact]),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockContact]),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockContact]),
            }),
          }),
        }),
      },
    } as unknown as DbService;

    service = new ContactsService(mockDbService);
  });

  describe("upsert", () => {
    it("should create new contact when not found", async () => {
      vi.spyOn(service, "findByProviderId").mockResolvedValue(null);

      const result = await service.upsert("org-1", "WHATSAPP", "123456789", "New Contact");

      expect(result).toBeDefined();
      expect(result.id).toBe("contact-1");
    });

    it("should update existing contact when found", async () => {
      vi.spyOn(service, "findByProviderId").mockResolvedValue(mockContact);

      const result = await service.upsert("org-1", "WHATSAPP", "123456789", undefined, {
        newData: "value",
      });

      expect(result).toBeDefined();
    });

    it("should update displayName only if contact has none", async () => {
      const contactWithoutName = { ...mockContact, displayName: null };
      vi.spyOn(service, "findByProviderId").mockResolvedValue(contactWithoutName);

      await service.upsert("org-1", "WHATSAPP", "123456789", "New Display Name");

      expect(mockDbService.db.update).toHaveBeenCalled();
    });
  });

  describe("findByProviderId", () => {
    it("should return contact when found", async () => {
      const result = await service.findByProviderId("org-1", "WHATSAPP", "123456789");

      expect(result).toBeDefined();
      expect(result?.providerId).toBe("123456789");
    });

    it("should return null when contact not found", async () => {
      mockDbService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.findByProviderId("org-1", "WHATSAPP", "non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findById", () => {
    it("should return contact when found", async () => {
      const result = await service.findById("contact-1");

      expect(result).toBeDefined();
      expect(result?.id).toBe("contact-1");
    });

    it("should return null when contact not found", async () => {
      mockDbService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.findById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findByIdOrFail", () => {
    it("should return contact when found", async () => {
      vi.spyOn(service, "findById").mockResolvedValue(mockContact);

      const result = await service.findByIdOrFail("contact-1");

      expect(result.id).toBe("contact-1");
    });

    it("should throw NotFoundException when contact not found", async () => {
      vi.spyOn(service, "findById").mockResolvedValue(null);

      await expect(service.findByIdOrFail("non-existent")).rejects.toThrow(NotFoundException);
    });
  });

  describe("findAll", () => {
    it("should return list of contacts", async () => {
      mockDbService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockContact]),
          }),
        }),
      });

      const result = await service.findAll("org-1");

      expect(result).toHaveLength(1);
    });

    it("should respect limit parameter", async () => {
      const limitMock = vi.fn().mockResolvedValue([]);
      mockDbService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: limitMock,
          }),
        }),
      });

      await service.findAll("org-1", 50);

      expect(limitMock).toHaveBeenCalledWith(50);
    });
  });

  describe("updateLastSeen", () => {
    it("should update lastSeenAt timestamp", async () => {
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      mockDbService.db.update = vi.fn().mockReturnValue({ set: setMock });

      await service.updateLastSeen("contact-1");

      expect(setMock).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update contact successfully", async () => {
      vi.spyOn(service, "findByIdOrFail").mockResolvedValue(mockContact);

      const result = await service.update("contact-1", "Updated Name");

      expect(result).toBeDefined();
    });

    it("should throw NotFoundException when contact not found", async () => {
      vi.spyOn(service, "findByIdOrFail").mockRejectedValue(
        new NotFoundException("Contact not found"),
      );

      await expect(service.update("non-existent", "Test")).rejects.toThrow(NotFoundException);
    });

    it("should merge metadata when updating", async () => {
      const contactWithMetadata = { ...mockContact, metadata: { existing: "data" } };
      vi.spyOn(service, "findByIdOrFail").mockResolvedValue(contactWithMetadata);

      await service.update("contact-1", undefined, { newKey: "newValue" });

      expect(mockDbService.db.update).toHaveBeenCalled();
    });
  });
});
