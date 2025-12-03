import { NotFoundException, ConflictException } from "@nestjs/common";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AuthService } from "../auth/auth.service";
import type { DbService } from "../db/db.service";
import { UsersService } from "./users.service";

// Mock user data
const mockUser = {
  id: "user-1",
  organizationId: "org-1",
  email: "test@example.com",
  passwordHash: "hashed-password",
  name: "Test User",
  role: "AGENT" as const,
  avatarUrl: null,
  status: "ACTIVE" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("UsersService", () => {
  let service: UsersService;
  let mockDbService: DbService;
  let mockAuthService: AuthService;

  beforeEach(() => {
    mockDbService = {
      db: {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockUser]),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockUser]),
            }),
          }),
        }),
      },
    } as unknown as DbService;

    mockAuthService = {
      hashPassword: vi.fn().mockResolvedValue("hashed-password"),
      verifyPassword: vi.fn().mockResolvedValue(true),
    } as unknown as AuthService;

    service = new UsersService(mockDbService, mockAuthService);
  });

  describe("create", () => {
    it("should create a new user successfully", async () => {
      // Mock findByEmail to return null (no existing user)
      vi.spyOn(service, "findByEmail").mockResolvedValue(null);

      const dto = {
        email: "new@example.com",
        password: "password123",
        name: "New User",
      };

      const result = await service.create("org-1", dto);

      expect(result).toBeDefined();
      expect(result.passwordHash).toBe("[REDACTED]");
      expect(mockAuthService.hashPassword).toHaveBeenCalledWith("password123");
    });

    it("should throw ConflictException if user already exists", async () => {
      vi.spyOn(service, "findByEmail").mockResolvedValue(mockUser);

      const dto = {
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      };

      await expect(service.create("org-1", dto)).rejects.toThrow(ConflictException);
    });
  });

  describe("findById", () => {
    it("should return user when found", async () => {
      const result = await service.findById("user-1");

      expect(result).toBeDefined();
      expect(result?.id).toBe("user-1");
      expect(result?.passwordHash).toBe("[REDACTED]");
    });

    it("should return null when user not found", async () => {
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
    it("should return user when found", async () => {
      vi.spyOn(service, "findById").mockResolvedValue(mockUser);

      const result = await service.findByIdOrFail("user-1");

      expect(result).toBeDefined();
      expect(result.id).toBe("user-1");
    });

    it("should throw NotFoundException when user not found", async () => {
      vi.spyOn(service, "findById").mockResolvedValue(null);

      await expect(service.findByIdOrFail("non-existent")).rejects.toThrow(NotFoundException);
    });
  });

  describe("findAll", () => {
    it("should return list of users with sanitized passwords", async () => {
      mockDbService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser, { ...mockUser, id: "user-2" }]),
          }),
        }),
      });

      const result = await service.findAll("org-1");

      expect(result).toHaveLength(2);
      expect(result[0].passwordHash).toBe("[REDACTED]");
    });

    it("should respect limit parameter", async () => {
      const limitMock = vi.fn().mockResolvedValue([mockUser]);
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

  describe("update", () => {
    it("should update user successfully", async () => {
      vi.spyOn(service, "findByIdOrFail").mockResolvedValue(mockUser);

      const result = await service.update("user-1", { name: "Updated Name" });

      expect(result).toBeDefined();
    });

    it("should throw NotFoundException when user not found", async () => {
      vi.spyOn(service, "findByIdOrFail").mockRejectedValue(
        new NotFoundException("User not found"),
      );

      await expect(service.update("non-existent", { name: "Test" })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("verifyPassword", () => {
    it("should return true for correct password", async () => {
      mockDbService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      const result = await service.verifyPassword(mockUser, "correctPassword");

      expect(result).toBe(true);
      expect(mockAuthService.verifyPassword).toHaveBeenCalled();
    });

    it("should return false when user not found in db", async () => {
      mockDbService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.verifyPassword(mockUser, "password");

      expect(result).toBe(false);
    });
  });
});
