import type { Readable } from "node:stream";
import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Res,
  StreamableFile,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { AttachmentsService } from "./attachments.service";

@ApiTags("Attachments")
@ApiBearerAuth()
@Controller("attachments")
export class StorageController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  /**
   * Download an attachment by ID
   */
  @Get(":id/download")
  @Header("Cache-Control", "max-age=31536000")
  @ApiOperation({ summary: "Download attachment file" })
  @ApiParam({ name: "id", description: "Attachment ID" })
  @ApiResponse({ status: 200, description: "File content" })
  @ApiResponse({ status: 404, description: "Attachment not found" })
  async download(
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const attachment = await this.attachmentsService.findById(id);
    if (!attachment) {
      throw new NotFoundException(`Attachment ${id} not found`);
    }

    const stream = this.attachmentsService.getReadStream(attachment);

    res.set({
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
      "Content-Length": attachment.sizeBytes,
    });

    return new StreamableFile(stream as Readable);
  }

  /**
   * Get attachment metadata
   */
  @Get(":id")
  @ApiOperation({ summary: "Get attachment metadata" })
  @ApiParam({ name: "id", description: "Attachment ID" })
  @ApiResponse({
    status: 200,
    description: "Attachment metadata",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        messageId: { type: "string" },
        fileName: { type: "string" },
        mimeType: { type: "string" },
        sizeBytes: { type: "string" },
        createdAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({ status: 404, description: "Attachment not found" })
  async getMetadata(@Param("id") id: string) {
    const attachment = await this.attachmentsService.findById(id);
    if (!attachment) {
      throw new NotFoundException(`Attachment ${id} not found`);
    }

    return {
      id: attachment.id,
      messageId: attachment.messageId,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      createdAt: attachment.createdAt,
    };
  }
}
