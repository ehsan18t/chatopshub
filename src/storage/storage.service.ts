import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import { extname, join } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";

export interface UploadedFile {
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface FileMetadata {
  exists: boolean;
  sizeBytes: number;
  mimeType?: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly storagePath: string;
  private readonly storageType: string;

  constructor(private readonly configService: ConfigService) {
    this.storagePath = this.configService.get<string>("STORAGE_PATH", "./uploads");
    this.storageType = this.configService.get<string>("STORAGE_TYPE", "local");
  }

  async onModuleInit(): Promise<void> {
    if (this.storageType === "local") {
      await this.ensureDirectory(this.storagePath);
      this.logger.log(`Storage initialized at ${this.storagePath}`);
    }
  }

  /**
   * Upload a file from a buffer
   */
  async uploadFromBuffer(
    buffer: Buffer,
    originalFileName: string,
    mimeType: string,
    organizationId: string,
  ): Promise<UploadedFile> {
    const ext = extname(originalFileName) || this.getExtensionFromMimeType(mimeType);
    const uniqueFileName = `${randomUUID()}${ext}`;
    const relativePath = join(organizationId, this.getDatePath(), uniqueFileName);
    const fullPath = join(this.storagePath, relativePath);

    await this.ensureDirectory(join(this.storagePath, organizationId, this.getDatePath()));

    const writeStream = createWriteStream(fullPath);
    await new Promise<void>((resolve, reject) => {
      writeStream.write(buffer, (err) => {
        if (err) reject(err);
        else {
          writeStream.end();
          resolve();
        }
      });
    });

    return {
      storagePath: relativePath,
      fileName: originalFileName,
      mimeType,
      sizeBytes: buffer.length,
    };
  }

  /**
   * Upload a file from a readable stream
   */
  async uploadFromStream(
    stream: Readable,
    originalFileName: string,
    mimeType: string,
    organizationId: string,
  ): Promise<UploadedFile> {
    const ext = extname(originalFileName) || this.getExtensionFromMimeType(mimeType);
    const uniqueFileName = `${randomUUID()}${ext}`;
    const relativePath = join(organizationId, this.getDatePath(), uniqueFileName);
    const fullPath = join(this.storagePath, relativePath);

    await this.ensureDirectory(join(this.storagePath, organizationId, this.getDatePath()));

    const writeStream = createWriteStream(fullPath);
    await pipeline(stream, writeStream);

    const stats = await stat(fullPath);

    return {
      storagePath: relativePath,
      fileName: originalFileName,
      mimeType,
      sizeBytes: stats.size,
    };
  }

  /**
   * Download a file from external URL and store it
   */
  async downloadAndStore(
    url: string,
    originalFileName: string,
    mimeType: string,
    organizationId: string,
  ): Promise<UploadedFile> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file from ${url}: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return this.uploadFromBuffer(buffer, originalFileName, mimeType, organizationId);
  }

  /**
   * Get a read stream for a file
   */
  getReadStream(storagePath: string): NodeJS.ReadableStream {
    const fullPath = join(this.storagePath, storagePath);
    return createReadStream(fullPath);
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(storagePath: string): Promise<FileMetadata> {
    const fullPath = join(this.storagePath, storagePath);
    try {
      const stats = await stat(fullPath);
      return {
        exists: true,
        sizeBytes: stats.size,
      };
    } catch {
      return {
        exists: false,
        sizeBytes: 0,
      };
    }
  }

  /**
   * Delete a file
   */
  async delete(storagePath: string): Promise<void> {
    const fullPath = join(this.storagePath, storagePath);
    try {
      await unlink(fullPath);
    } catch (error) {
      this.logger.warn(`Failed to delete file ${storagePath}: ${error}`);
    }
  }

  /**
   * Get the full path for serving files
   */
  getFullPath(storagePath: string): string {
    return join(this.storagePath, storagePath);
  }

  /**
   * Generate a date-based path for organizing files
   */
  private getDatePath(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return join(String(year), month, day);
  }

  /**
   * Ensure a directory exists
   */
  private async ensureDirectory(dir: string): Promise<void> {
    try {
      await mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory already exists, ignore
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
  }

  /**
   * Get file extension from mime type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "video/mp4": ".mp4",
      "video/webm": ".webm",
      "audio/mpeg": ".mp3",
      "audio/ogg": ".ogg",
      "audio/wav": ".wav",
      "application/pdf": ".pdf",
      "application/msword": ".doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
      "application/vnd.ms-excel": ".xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
      "text/plain": ".txt",
      "text/csv": ".csv",
    };
    return mimeToExt[mimeType] || "";
  }
}
