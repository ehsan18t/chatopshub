import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser, type CurrentUserPayload } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/index";
import type { ChannelsService } from "./channels.service";
import type { CreateChannelDto, UpdateChannelDto } from "./dto/index";

@ApiTags("Channels")
@ApiBearerAuth()
@Controller("channels")
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Post()
  @Roles("ADMIN")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new channel (Admin only)" })
  @ApiResponse({ status: 201, description: "Channel created successfully" })
  async create(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() createChannelDto: CreateChannelDto,
  ) {
    return this.channelsService.create(currentUser.organizationId, createChannelDto);
  }

  @Get()
  @ApiOperation({ summary: "List all channels in organization" })
  @ApiResponse({ status: 200, description: "Channels retrieved successfully" })
  async findAll(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.channelsService.findAll(currentUser.organizationId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get channel by ID" })
  @ApiResponse({ status: 200, description: "Channel retrieved successfully" })
  @ApiResponse({ status: 404, description: "Channel not found" })
  async findOne(@Param("id") id: string) {
    return this.channelsService.findByIdOrFail(id);
  }

  @Patch(":id")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Update channel (Admin only)" })
  @ApiResponse({ status: 200, description: "Channel updated successfully" })
  @ApiResponse({ status: 404, description: "Channel not found" })
  async update(@Param("id") id: string, @Body() updateChannelDto: UpdateChannelDto) {
    return this.channelsService.update(id, updateChannelDto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete channel (Admin only)" })
  @ApiResponse({ status: 204, description: "Channel deleted successfully" })
  @ApiResponse({ status: 404, description: "Channel not found" })
  async delete(@Param("id") id: string) {
    return this.channelsService.delete(id);
  }

  @Post(":id/test")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Test channel connection (Admin only)" })
  @ApiResponse({ status: 200, description: "Connection test result" })
  @ApiResponse({ status: 404, description: "Channel not found" })
  async testConnection(@Param("id") id: string) {
    return this.channelsService.testConnection(id);
  }
}
