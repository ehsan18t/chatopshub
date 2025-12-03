import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class CreateMessageDto {
  @ApiPropertyOptional({ example: "Hello, how can I help you?" })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ example: "https://example.com/image.jpg" })
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional({ example: "image/jpeg" })
  @IsOptional()
  @IsString()
  mediaType?: string;
}

export class MessageQueryDto {
  @ApiPropertyOptional({ description: "Cursor for pagination (message ID)" })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 50, description: "Number of messages to return" })
  @IsOptional()
  limit?: number;
}
