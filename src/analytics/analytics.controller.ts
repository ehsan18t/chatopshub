import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "@/common/decorators/roles.decorator";
import { RolesGuard } from "@/common/guards/roles.guard";
import type { AnalyticsService } from "./analytics.service";

@ApiTags("Analytics")
@Controller("analytics")
@UseGuards(RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("dashboard/:organizationId")
  @ApiOperation({ summary: "Get real-time dashboard statistics" })
  @ApiResponse({ status: 200, description: "Dashboard stats" })
  async getDashboard(@Param("organizationId") organizationId: string) {
    return this.analyticsService.getDashboardStats(organizationId);
  }

  @Get("organization/:organizationId")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Get organization-wide statistics" })
  @ApiQuery({ name: "startDate", required: false })
  @ApiQuery({ name: "endDate", required: false })
  @ApiResponse({ status: 200, description: "Organization stats" })
  async getOrganizationStats(
    @Param("organizationId") organizationId: string,
    @Query("startDate") startDateStr?: string,
    @Query("endDate") endDateStr?: string,
  ) {
    const endDate = endDateStr ? new Date(endDateStr) : new Date();
    const startDate = startDateStr
      ? new Date(startDateStr)
      : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days

    return this.analyticsService.getOrganizationStats(organizationId, startDate, endDate);
  }

  @Get("agent/:agentId")
  @ApiOperation({ summary: "Get agent performance statistics" })
  @ApiQuery({ name: "startDate", required: false })
  @ApiQuery({ name: "endDate", required: false })
  @ApiResponse({ status: 200, description: "Agent performance stats" })
  async getAgentPerformance(
    @Param("agentId") agentId: string,
    @Query("startDate") startDateStr?: string,
    @Query("endDate") endDateStr?: string,
  ) {
    const endDate = endDateStr ? new Date(endDateStr) : new Date();
    const startDate = startDateStr
      ? new Date(startDateStr)
      : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    return this.analyticsService.getAgentPerformance(agentId, startDate, endDate);
  }
}
