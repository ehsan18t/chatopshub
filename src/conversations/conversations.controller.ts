import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser, type CurrentUserPayload } from "../common/decorators/current-user.decorator";
import type { ConversationEventsService } from "./conversation-events.service";
import type { ConversationsService } from "./conversations.service";
import type { ConversationQueryDto } from "./dto/index";

@ApiTags("Conversations")
@ApiBearerAuth()
@Controller("conversations")
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly eventsService: ConversationEventsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List conversations with filters" })
  @ApiResponse({ status: 200, description: "Conversations retrieved successfully" })
  async findAll(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Query() query: ConversationQueryDto,
  ) {
    return this.conversationsService.findAll(currentUser.organizationId, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get conversation by ID with relations" })
  @ApiResponse({ status: 200, description: "Conversation retrieved successfully" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  async findOne(@Param("id") id: string) {
    const conversation = await this.conversationsService.findByIdWithRelations(id);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    return conversation;
  }

  @Post(":id/accept")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Accept/assign a pending conversation" })
  @ApiResponse({ status: 200, description: "Conversation accepted successfully" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  @ApiResponse({ status: 409, description: "Conversation is not available" })
  async accept(@Param("id") id: string, @CurrentUser() currentUser: CurrentUserPayload) {
    return this.conversationsService.accept(id, currentUser.id);
  }

  @Post(":id/release")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Release an assigned conversation back to pending" })
  @ApiResponse({ status: 200, description: "Conversation released successfully" })
  @ApiResponse({ status: 403, description: "Not assigned to this conversation" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  @ApiResponse({ status: 409, description: "Conversation is not assigned" })
  async release(@Param("id") id: string, @CurrentUser() currentUser: CurrentUserPayload) {
    return this.conversationsService.release(id, currentUser.id);
  }

  @Post(":id/complete")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark conversation as completed" })
  @ApiResponse({ status: 200, description: "Conversation completed successfully" })
  @ApiResponse({ status: 403, description: "Not assigned to this conversation" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  @ApiResponse({ status: 409, description: "Conversation must be assigned" })
  async complete(@Param("id") id: string, @CurrentUser() currentUser: CurrentUserPayload) {
    return this.conversationsService.complete(id, currentUser.id);
  }

  @Get(":id/events")
  @ApiOperation({ summary: "Get conversation event history (audit trail)" })
  @ApiResponse({ status: 200, description: "Events retrieved successfully" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  async getEvents(@Param("id") id: string, @Query("page") page = 1, @Query("limit") limit = 50) {
    // Verify conversation exists
    await this.conversationsService.findByIdOrFail(id);
    return this.eventsService.findByConversation(id, page, limit);
  }
}
