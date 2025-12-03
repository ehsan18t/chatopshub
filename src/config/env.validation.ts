import { plainToInstance } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from "class-validator";

enum Environment {
  Development = "development",
  Production = "production",
  Test = "test",
}

enum StorageType {
  Local = "local",
  S3 = "s3",
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Min(1024)
  @Max(65535)
  PORT: number = 3001;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  VALKEY_URL!: string;

  @IsString()
  AUTH_SECRET!: string;

  @IsUrl({ require_tld: false })
  AUTH_URL!: string;

  @IsUrl({ require_tld: false })
  FRONTEND_URL!: string;

  @IsString()
  @IsOptional()
  WHATSAPP_VERIFY_TOKEN?: string;

  @IsString()
  @IsOptional()
  WHATSAPP_APP_SECRET?: string;

  @IsString()
  @IsOptional()
  MESSENGER_VERIFY_TOKEN?: string;

  @IsString()
  @IsOptional()
  MESSENGER_APP_SECRET?: string;

  @IsEnum(StorageType)
  @IsOptional()
  STORAGE_TYPE?: StorageType = StorageType.Local;

  @IsString()
  @IsOptional()
  STORAGE_PATH?: string = "./uploads";
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((error) => {
        const constraints = error.constraints ? Object.values(error.constraints).join(", ") : "";
        return `${error.property}: ${constraints}`;
      })
      .join("\n");

    throw new Error(`Environment validation failed:\n${errorMessages}`);
  }

  return validatedConfig;
}
