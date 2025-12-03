import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsObject, IsOptional, IsString } from "class-validator";

export class WhatsAppConfigDto {
  @ApiProperty({ example: "123456789" })
  @IsString()
  phoneNumberId!: string;

  @ApiProperty({ example: "EAAGxxx..." })
  @IsString()
  accessToken!: string;

  @ApiPropertyOptional({ example: "987654321" })
  @IsOptional()
  @IsString()
  businessAccountId?: string;
}

export class MessengerConfigDto {
  @ApiProperty({ example: "123456789" })
  @IsString()
  pageId!: string;

  @ApiProperty({ example: "EAAGxxx..." })
  @IsString()
  pageAccessToken!: string;

  @ApiPropertyOptional({ example: "app_secret_xxx" })
  @IsOptional()
  @IsString()
  appSecret?: string;
}

export class CreateChannelDto {
  @ApiProperty({ enum: ["WHATSAPP", "MESSENGER"] })
  @IsEnum(["WHATSAPP", "MESSENGER"])
  provider!: "WHATSAPP" | "MESSENGER";

  @ApiProperty({ example: "Main WhatsApp Line" })
  @IsString()
  name!: string;

  @ApiProperty({ type: Object, description: "Provider-specific configuration" })
  @IsObject()
  config!: WhatsAppConfigDto | MessengerConfigDto;

  @ApiPropertyOptional({ description: "Webhook verification secret" })
  @IsOptional()
  @IsString()
  webhookSecret?: string;
}
