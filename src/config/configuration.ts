export interface EnvironmentVariables {
  // Database
  DATABASE_URL: string;

  // Valkey
  VALKEY_URL: string;

  // Auth
  AUTH_SECRET: string;
  AUTH_URL: string;

  // CORS
  FRONTEND_URL: string;

  // WhatsApp
  WHATSAPP_VERIFY_TOKEN: string;
  WHATSAPP_APP_SECRET: string;

  // Messenger
  MESSENGER_VERIFY_TOKEN: string;
  MESSENGER_APP_SECRET: string;

  // Storage
  STORAGE_TYPE: "local" | "s3";
  STORAGE_PATH: string;

  // Server
  PORT: number;
  NODE_ENV: "development" | "production" | "test";
}

export default (): Partial<EnvironmentVariables> => ({
  DATABASE_URL: process.env.DATABASE_URL,
  VALKEY_URL: process.env.VALKEY_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_URL: process.env.AUTH_URL,
  FRONTEND_URL: process.env.FRONTEND_URL,
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
  MESSENGER_VERIFY_TOKEN: process.env.MESSENGER_VERIFY_TOKEN,
  MESSENGER_APP_SECRET: process.env.MESSENGER_APP_SECRET,
  STORAGE_TYPE: (process.env.STORAGE_TYPE as "local" | "s3") ?? "local",
  STORAGE_PATH: process.env.STORAGE_PATH ?? "./uploads",
  PORT: parseInt(process.env.PORT ?? "3001", 10),
  NODE_ENV: (process.env.NODE_ENV as "development" | "production" | "test") ?? "development",
});
