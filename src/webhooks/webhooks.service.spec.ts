import * as crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { ContactsService } from "@/contacts/contacts.service";
import type { ConversationsService } from "@/conversations/conversations.service";
import type { DbService } from "@/db/db.service";
import type { MessagesService } from "@/messages/messages.service";
import { WebhooksService } from "./webhooks.service";

// Mock dependencies with minimal implementations for testing
const mockDbService = {
  db: {
    select: () => ({
      from: () => ({
        where: () => [],
      }),
    }),
  },
} as unknown as DbService;

const mockContactsService = {
  upsert: vi.fn().mockResolvedValue({ id: "contact-1", displayName: "Test Contact" }),
} as unknown as ContactsService;

const mockConversationsService = {
  findOrCreate: vi.fn().mockResolvedValue({ id: "conv-1", status: "PENDING" }),
  updateLastMessageAt: vi.fn().mockResolvedValue(undefined),
  reopen: vi.fn().mockResolvedValue({ id: "conv-1", status: "PENDING" }),
} as unknown as ConversationsService;

const mockMessagesService = {
  create: vi.fn().mockResolvedValue({ id: "msg-1" }),
  updateStatus: vi.fn().mockResolvedValue({ id: "msg-1" }),
  markDelivered: vi.fn().mockResolvedValue({ id: "msg-1" }),
  markRead: vi.fn().mockResolvedValue({ id: "msg-1" }),
} as unknown as MessagesService;

describe("WebhooksService", () => {
  const createService = () => {
    return new WebhooksService(
      mockDbService,
      mockContactsService,
      mockConversationsService,
      mockMessagesService,
    );
  };

  describe("validateWhatsAppSignature", () => {
    it("should return true for valid signature", () => {
      const service = createService();
      const payload = '{"test":"data"}';
      const appSecret = "test-secret";

      const expectedHash = crypto.createHmac("sha256", appSecret).update(payload).digest("hex");
      const signature = `sha256=${expectedHash}`;

      const result = service.validateWhatsAppSignature(payload, signature, appSecret);
      expect(result).toBe(true);
    });

    it("should return false for invalid signature with different hash", () => {
      const service = createService();
      const payload = '{"test":"data"}';
      const appSecret = "test-secret";

      const wrongHash = crypto.createHmac("sha256", "wrong-secret").update(payload).digest("hex");
      const signature = `sha256=${wrongHash}`;

      const result = service.validateWhatsAppSignature(payload, signature, appSecret);
      expect(result).toBe(false);
    });

    it("should return false for missing sha256 prefix", () => {
      const service = createService();
      const payload = '{"test":"data"}';
      const appSecret = "test-secret";
      const signature = "invalid_prefix=somehash";

      const result = service.validateWhatsAppSignature(payload, signature, appSecret);
      expect(result).toBe(false);
    });

    it("should return false for tampered payload", () => {
      const service = createService();
      const originalPayload = '{"test":"data"}';
      const tamperedPayload = '{"test":"tampered"}';
      const appSecret = "test-secret";

      const expectedHash = crypto
        .createHmac("sha256", appSecret)
        .update(originalPayload)
        .digest("hex");
      const signature = `sha256=${expectedHash}`;

      const result = service.validateWhatsAppSignature(tamperedPayload, signature, appSecret);
      expect(result).toBe(false);
    });
  });

  describe("validateMessengerSignature", () => {
    it("should return true for valid signature", () => {
      const service = createService();
      const payload = '{"object":"page","entry":[]}';
      const appSecret = "messenger-secret";

      const expectedHash = crypto.createHmac("sha256", appSecret).update(payload).digest("hex");
      const signature = `sha256=${expectedHash}`;

      const result = service.validateMessengerSignature(payload, signature, appSecret);
      expect(result).toBe(true);
    });

    it("should return false for invalid signature", () => {
      const service = createService();
      const payload = '{"object":"page"}';
      const appSecret = "messenger-secret";

      const wrongHash = crypto.createHmac("sha256", "wrong-secret").update(payload).digest("hex");
      const signature = `sha256=${wrongHash}`;

      const result = service.validateMessengerSignature(payload, signature, appSecret);
      expect(result).toBe(false);
    });
  });
});
