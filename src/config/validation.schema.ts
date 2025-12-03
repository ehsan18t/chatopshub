import { plainToInstance } from "class-transformer";
import { IsEnum, IsNumber, IsString, validateSync } from "class-validator";

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
  @IsString()
  DATABASE_URL!: string;

  @IsString()
  VALKEY_URL!: string;

  @IsString()
  AUTH_SECRET!: string;

  @IsString()
  AUTH_URL!: string;

  @IsString()
  FRONTEND_URL!: string;

  @IsString()
  WHATSAPP_VERIFY_TOKEN!: string;

  @IsString()
  WHATSAPP_APP_SECRET!: string;

  @IsString()
  MESSENGER_VERIFY_TOKEN!: string;

  @IsString()
  MESSENGER_APP_SECRET!: string;

  @IsEnum(StorageType)
  STORAGE_TYPE!: StorageType;

  @IsString()
  STORAGE_PATH!: string;

  @IsNumber()
  PORT!: number;

  @IsEnum(Environment)
  NODE_ENV!: Environment;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
