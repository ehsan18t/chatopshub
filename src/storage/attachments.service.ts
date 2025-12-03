import { Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { DbService } from "@/db/db.service";
import { type Attachment, attachments, type NewAttachment } from "@/db/schema/index";
import type { StorageService, UploadedFile } from "./storage.service";

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly db: DbService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Create an attachment record from an uploaded file
   */
  async create(messageId: string, uploadedFile: UploadedFile): Promise<Attachment> {
    const newAttachment: NewAttachment = {
      messageId,
      fileName: uploadedFile.fileName,
      storagePath: uploadedFile.storagePath,
      mimeType: uploadedFile.mimeType,
      sizeBytes: String(uploadedFile.sizeBytes),
    };

    const [created] = await this.db.db.insert(attachments).values(newAttachment).returning();
    return created;
  }

  /**
   * Create multiple attachments from uploaded files
   */
  async createMany(messageId: string, uploadedFiles: UploadedFile[]): Promise<Attachment[]> {
    if (uploadedFiles.length === 0) {
      return [];
    }

    const newAttachments: NewAttachment[] = uploadedFiles.map((file) => ({
      messageId,
      fileName: file.fileName,
      storagePath: file.storagePath,
      mimeType: file.mimeType,
      sizeBytes: String(file.sizeBytes),
    }));

    return this.db.db.insert(attachments).values(newAttachments).returning();
  }

  /**
   * Find attachment by ID
   */
  async findById(id: string): Promise<Attachment | null> {
    const [attachment] = await this.db.db
      .select()
      .from(attachments)
      .where(eq(attachments.id, id))
      .limit(1);

    return attachment || null;
  }

  /**
   * Find attachments by message ID
   */
  async findByMessageId(messageId: string): Promise<Attachment[]> {
    return this.db.db.select().from(attachments).where(eq(attachments.messageId, messageId));
  }

  /**
   * Delete attachment and its file
   */
  async delete(id: string): Promise<void> {
    const attachment = await this.findById(id);
    if (!attachment) {
      throw new NotFoundException(`Attachment ${id} not found`);
    }

    // Delete file from storage
    await this.storageService.delete(attachment.storagePath);

    // Delete database record
    await this.db.db.delete(attachments).where(eq(attachments.id, id));
  }

  /**
   * Delete all attachments for a message
   */
  async deleteByMessageId(messageId: string): Promise<void> {
    const messageAttachments = await this.findByMessageId(messageId);

    // Delete files from storage
    for (const attachment of messageAttachments) {
      await this.storageService.delete(attachment.storagePath);
    }

    // Delete database records
    await this.db.db.delete(attachments).where(eq(attachments.messageId, messageId));
  }

  /**
   * Get read stream for an attachment
   */
  getReadStream(attachment: Attachment): NodeJS.ReadableStream {
    return this.storageService.getReadStream(attachment.storagePath);
  }

  /**
   * Download from URL and create attachment
   */
  async downloadAndCreate(
    messageId: string,
    url: string,
    fileName: string,
    mimeType: string,
    organizationId: string,
  ): Promise<Attachment> {
    const uploadedFile = await this.storageService.downloadAndStore(
      url,
      fileName,
      mimeType,
      organizationId,
    );
    return this.create(messageId, uploadedFile);
  }
}
