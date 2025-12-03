import { Injectable } from "@nestjs/common";
import { hash, verify } from "@node-rs/argon2";

// Argon2 configuration (OWASP recommended)
const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

@Injectable()
export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return await hash(password, ARGON2_OPTIONS);
  }

  async verifyPassword(hashedPassword: string, password: string): Promise<boolean> {
    try {
      return await verify(hashedPassword, password);
    } catch {
      return false;
    }
  }
}
