import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsObject, IsOptional, IsString } from "class-validator";
import type { MessengerConfigDto, WhatsAppConfigDto } from "./create-channel.dto";

export class UpdateChannelDto {
  @ApiPropertyOptional({ example: "Updated WhatsApp Line" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ type: Object, description: "Provider-specific configuration" })
  @IsOptional()
  @IsObject()
  config?: WhatsAppConfigDto | MessengerConfigDto;

  @ApiPropertyOptional({ enum: ["ACTIVE", "INACTIVE", "ERROR"] })
  @IsOptional()
  @IsEnum(["ACTIVE", "INACTIVE", "ERROR"])
  status?: "ACTIVE" | "INACTIVE" | "ERROR";

  @ApiPropertyOptional({ description: "Webhook verification secret" })
  @IsOptional()
  @IsString()
  webhookSecret?: string;
}
