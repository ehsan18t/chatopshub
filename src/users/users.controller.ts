import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser, type CurrentUserPayload } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/index";
import type { CreateUserDto, UpdateUserDto } from "./dto/index";
import type { UsersService } from "./users.service";

@ApiTags("Users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles("ADMIN")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new user (Admin only)" })
  @ApiResponse({ status: 201, description: "User created successfully" })
  @ApiResponse({ status: 409, description: "User already exists" })
  async create(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.usersService.create(currentUser.organizationId, createUserDto);
  }

  @Get()
  @ApiOperation({ summary: "List all users in organization" })
  @ApiQuery({ name: "role", required: false, enum: ["ADMIN", "AGENT"] })
  @ApiResponse({ status: 200, description: "Users retrieved successfully" })
  async findAll(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Query("role") role?: "ADMIN" | "AGENT",
  ) {
    if (role) {
      return this.usersService.findByRole(currentUser.organizationId, role);
    }
    return this.usersService.findAll(currentUser.organizationId);
  }

  @Get("me")
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({ status: 200, description: "Profile retrieved successfully" })
  async getProfile(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.usersService.findByIdOrFail(currentUser.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get user by ID" })
  @ApiResponse({ status: 200, description: "User retrieved successfully" })
  @ApiResponse({ status: 404, description: "User not found" })
  async findOne(@Param("id") id: string) {
    return this.usersService.findByIdOrFail(id);
  }

  @Patch(":id")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Update user (Admin only)" })
  @ApiResponse({ status: 200, description: "User updated successfully" })
  @ApiResponse({ status: 404, description: "User not found" })
  async update(@Param("id") id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(":id/status")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Update user status (Admin only)" })
  @ApiResponse({ status: 200, description: "Status updated successfully" })
  @ApiResponse({ status: 404, description: "User not found" })
  async updateStatus(
    @Param("id") id: string,
    @Body("status") status: "ACTIVE" | "INACTIVE" | "SUSPENDED",
  ) {
    return this.usersService.updateStatus(id, status);
  }
}
