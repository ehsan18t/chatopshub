import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { ConfigService } from "@nestjs/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { StorageService } from "./storage.service";

// Mock ConfigService
const mockConfigService: Partial<ConfigService> = {
  get: ((key: string, defaultValue?: string) => {
    if (key === "STORAGE_PATH") return "./test-uploads";
    if (key === "STORAGE_TYPE") return "local";
    return defaultValue;
  }) as ConfigService["get"],
};

describe("StorageService", () => {
  const testStoragePath = "./test-uploads";
  let service: StorageService;

  beforeAll(async () => {
    service = new StorageService(mockConfigService as ConfigService);
    await service.onModuleInit();
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await rm(testStoragePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("uploadFromBuffer", () => {
    it("should upload a buffer and return file info", async () => {
      const buffer = Buffer.from("test content");
      const result = await service.uploadFromBuffer(buffer, "test.txt", "text/plain", "org-123");

      expect(result.fileName).toBe("test.txt");
      expect(result.mimeType).toBe("text/plain");
      expect(result.sizeBytes).toBe(buffer.length);
      expect(result.storagePath).toContain("org-123");
      expect(result.storagePath).toMatch(/\.txt$/);
    });

    it("should create unique file names for multiple uploads", async () => {
      const buffer = Buffer.from("test");

      const result1 = await service.uploadFromBuffer(buffer, "file.txt", "text/plain", "org-123");
      const result2 = await service.uploadFromBuffer(buffer, "file.txt", "text/plain", "org-123");

      expect(result1.storagePath).not.toBe(result2.storagePath);
    });
  });

  describe("getFileMetadata", () => {
    it("should return exists: false for non-existent file", async () => {
      const result = await service.getFileMetadata("non-existent/file.txt");

      expect(result.exists).toBe(false);
      expect(result.sizeBytes).toBe(0);
    });

    it("should return correct metadata for existing file", async () => {
      const buffer = Buffer.from("metadata test");
      const uploaded = await service.uploadFromBuffer(
        buffer,
        "metadata.txt",
        "text/plain",
        "org-123",
      );

      const result = await service.getFileMetadata(uploaded.storagePath);

      expect(result.exists).toBe(true);
      expect(result.sizeBytes).toBe(buffer.length);
    });
  });

  describe("delete", () => {
    it("should delete an existing file", async () => {
      const buffer = Buffer.from("delete test");
      const uploaded = await service.uploadFromBuffer(
        buffer,
        "to-delete.txt",
        "text/plain",
        "org-123",
      );

      await service.delete(uploaded.storagePath);

      const metadata = await service.getFileMetadata(uploaded.storagePath);
      expect(metadata.exists).toBe(false);
    });

    it("should not throw for non-existent file", async () => {
      await expect(service.delete("non-existent/file.txt")).resolves.toBeUndefined();
    });
  });

  describe("getFullPath", () => {
    it("should return correct full path", () => {
      const relativePath = "org-123/2025/01/01/file.txt";
      const fullPath = service.getFullPath(relativePath);

      expect(fullPath).toBe(join(testStoragePath, relativePath));
    });
  });

  describe("getExtensionFromMimeType (via uploadFromBuffer)", () => {
    it("should add correct extension for image/jpeg", async () => {
      const buffer = Buffer.from("fake jpeg");
      const result = await service.uploadFromBuffer(
        buffer,
        "image", // No extension
        "image/jpeg",
        "org-123",
      );

      expect(result.storagePath).toMatch(/\.jpg$/);
    });

    it("should add correct extension for application/pdf", async () => {
      const buffer = Buffer.from("fake pdf");
      const result = await service.uploadFromBuffer(
        buffer,
        "document",
        "application/pdf",
        "org-123",
      );

      expect(result.storagePath).toMatch(/\.pdf$/);
    });

    it("should preserve original extension when present", async () => {
      const buffer = Buffer.from("test");
      const result = await service.uploadFromBuffer(buffer, "file.custom", "text/plain", "org-123");

      expect(result.storagePath).toMatch(/\.custom$/);
    });
  });
});
