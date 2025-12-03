import { Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import configuration from "./configuration";

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [".env", ".env.local"],
      // Disable validation in development to allow partial env
      // validate: process.env.NODE_ENV === 'production' ? validate : undefined,
    }),
  ],
})
export class ConfigModule {}
