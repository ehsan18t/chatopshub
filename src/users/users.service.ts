import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { AuthService } from "../auth/auth.service";
import type { DbService } from "../db/db.service";
import { type NewUser, type User, users } from "../db/schema/index";
import type { CreateUserDto, UpdateUserDto } from "./dto/index";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly dbService: DbService,
    private readonly authService: AuthService,
  ) {}

  async create(organizationId: string, dto: CreateUserDto): Promise<User> {
    // Check if user with email already exists in organization
    const existingUser = await this.findByEmail(organizationId, dto.email);
    if (existingUser) {
      throw new ConflictException("User with this email already exists in the organization");
    }

    const passwordHash = await this.authService.hashPassword(dto.password);

    const newUser: NewUser = {
      organizationId,
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: dto.role ?? "AGENT",
      avatarUrl: dto.avatarUrl,
      status: "ACTIVE",
    };

    const [user] = await this.dbService.db.insert(users).values(newUser).returning();

    this.logger.log(`User created: ${user.id}`);
    return this.sanitizeUser(user);
  }

  async findById(id: string): Promise<User | null> {
    const [user] = await this.dbService.db.select().from(users).where(eq(users.id, id)).limit(1);

    return user ? this.sanitizeUser(user) : null;
  }

  async findByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  async findByEmail(organizationId: string, email: string): Promise<User | null> {
    const [user] = await this.dbService.db
      .select()
      .from(users)
      .where(and(eq(users.organizationId, organizationId), eq(users.email, email)))
      .limit(1);

    return user ?? null;
  }

  async findByEmailWithPassword(organizationId: string, email: string): Promise<User | null> {
    const [user] = await this.dbService.db
      .select()
      .from(users)
      .where(and(eq(users.organizationId, organizationId), eq(users.email, email)))
      .limit(1);

    return user ?? null;
  }

  async findAll(organizationId: string, limit = 100): Promise<User[]> {
    const userList = await this.dbService.db
      .select()
      .from(users)
      .where(eq(users.organizationId, organizationId))
      .limit(limit);

    return userList.map((user) => this.sanitizeUser(user));
  }

  async findByRole(organizationId: string, role: "ADMIN" | "AGENT", limit = 100): Promise<User[]> {
    const userList = await this.dbService.db
      .select()
      .from(users)
      .where(and(eq(users.organizationId, organizationId), eq(users.role, role)))
      .limit(limit);

    return userList.map((user) => this.sanitizeUser(user));
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    await this.findByIdOrFail(id);

    const [updated] = await this.dbService.db
      .update(users)
      .set({
        ...dto,
      })
      .where(eq(users.id, id))
      .returning();

    this.logger.log(`User updated: ${id}`);
    return this.sanitizeUser(updated);
  }

  async updateStatus(id: string, status: "ACTIVE" | "INACTIVE" | "SUSPENDED"): Promise<User> {
    await this.findByIdOrFail(id);

    const [updated] = await this.dbService.db
      .update(users)
      .set({ status })
      .where(eq(users.id, id))
      .returning();

    this.logger.log(`User status updated: ${id} -> ${status}`);
    return this.sanitizeUser(updated);
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    // Need to fetch user with password hash
    const [fullUser] = await this.dbService.db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!fullUser) {
      return false;
    }

    return this.authService.verifyPassword(fullUser.passwordHash, password);
  }

  private sanitizeUser(user: User): User {
    // Remove sensitive fields
    return {
      ...user,
      passwordHash: "[REDACTED]",
    };
  }
}
