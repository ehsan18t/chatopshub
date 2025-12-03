import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class CreateContactDto {
  @ApiProperty({ example: "+15551234567", description: "Phone number or PSID from provider" })
  @IsString()
  providerId!: string;

  @ApiProperty({ enum: ["WHATSAPP", "MESSENGER"] })
  @IsEnum(["WHATSAPP", "MESSENGER"])
  provider!: "WHATSAPP" | "MESSENGER";

  @ApiPropertyOptional({ example: "John Doe" })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateContactDto {
  @ApiPropertyOptional({ example: "John Doe" })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
