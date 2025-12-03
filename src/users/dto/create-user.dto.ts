import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export class CreateUserDto {
  @ApiProperty({ example: "john@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "password123", minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: "John Doe" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ enum: ["ADMIN", "AGENT"], default: "AGENT" })
  @IsOptional()
  @IsEnum(["ADMIN", "AGENT"])
  role?: "ADMIN" | "AGENT";

  @ApiPropertyOptional({ example: "https://example.com/avatar.png" })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
