import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class ConversationQueryDto {
  @ApiPropertyOptional({ enum: ["PENDING", "ASSIGNED", "COMPLETED"] })
  @IsOptional()
  @IsEnum(["PENDING", "ASSIGNED", "COMPLETED"])
  status?: "PENDING" | "ASSIGNED" | "COMPLETED";

  @ApiPropertyOptional({ description: "Filter by channel ID" })
  @IsOptional()
  @IsString()
  channelId?: string;

  @ApiPropertyOptional({ description: "Filter by assigned agent ID" })
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiPropertyOptional({ description: "Search in contact name" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}
