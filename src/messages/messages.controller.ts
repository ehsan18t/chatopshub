import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser, type CurrentUserPayload } from "../common/decorators/current-user.decorator";
import type { ConversationsService } from "../conversations/conversations.service";
import type { CreateMessageDto, MessageQueryDto } from "./dto/index";
import type { MessagesService } from "./messages.service";

@ApiTags("Messages")
@ApiBearerAuth()
@Controller("conversations/:conversationId/messages")
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get messages for a conversation (cursor pagination)" })
  @ApiResponse({ status: 200, description: "Messages retrieved successfully" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  async findAll(@Param("conversationId") conversationId: string, @Query() query: MessageQueryDto) {
    // Verify conversation exists
    await this.conversationsService.findByIdOrFail(conversationId);

    return this.messagesService.findByConversation(conversationId, query.cursor, query.limit ?? 50);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Send a message (outbound)" })
  @ApiResponse({ status: 201, description: "Message sent successfully" })
  @ApiResponse({ status: 403, description: "Not assigned to this conversation" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  async create(
    @Param("conversationId") conversationId: string,
    @Body() createMessageDto: CreateMessageDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    // Verify conversation exists and user is assigned
    const conversation = await this.conversationsService.findByIdOrFail(conversationId);

    if (conversation.assignedAgentId !== currentUser.id) {
      throw new ForbiddenException("You are not assigned to this conversation");
    }

    // Create outbound message
    return this.messagesService.create(
      conversationId,
      "OUTBOUND",
      createMessageDto,
      currentUser.id,
    );
  }
}
