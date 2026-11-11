import { Controller, Get, Delete, Param, UseGuards, Req } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Request } from "express";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard, AuthenticatedUser } from "../auth/guards/jwt-auth.guard";

@ApiTags("Report History")
@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({ summary: "List generated standup report histories" })
  async listReports(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.reportsService.listReports(req.user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get single report details" })
  async getReport(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param("id") id: string,
  ) {
    return this.reportsService.getReportById(req.user.id, id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a report from history" })
  async deleteReport(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param("id") id: string,
  ) {
    return this.reportsService.deleteReport(req.user.id, id);
  }
}
