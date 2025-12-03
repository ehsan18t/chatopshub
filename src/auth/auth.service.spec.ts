import { describe, it, expect, beforeEach } from "vitest";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
  });

  describe("hashPassword", () => {
    it("should hash a password successfully", async () => {
      const password = "securePassword123!";
      const hash = await service.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it("should generate different hashes for the same password", async () => {
      const password = "securePassword123!";
      const hash1 = await service.hashPassword(password);
      const hash2 = await service.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyPassword", () => {
    it("should return true for correct password", async () => {
      const password = "securePassword123!";
      const hash = await service.hashPassword(password);

      const result = await service.verifyPassword(hash, password);

      expect(result).toBe(true);
    });

    it("should return false for incorrect password", async () => {
      const password = "securePassword123!";
      const hash = await service.hashPassword(password);

      const result = await service.verifyPassword(hash, "wrongPassword!");

      expect(result).toBe(false);
    });

    it("should return false for invalid hash format", async () => {
      const result = await service.verifyPassword("invalid-hash", "password");

      expect(result).toBe(false);
    });

    it("should return false for empty hash", async () => {
      const result = await service.verifyPassword("", "password");

      expect(result).toBe(false);
    });
  });
});
