import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";
import { APP_VERSION } from "../common/version";

@ApiTags("Health & Telemetry")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Health check probe" })
  @ApiResponse({ status: 200, description: "Service is healthy" })
  async check() {
    let dbStatus = "disconnected";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = "connected";
    } catch {
      dbStatus = "unreachable";
    }

    return {
      status: "ok",
      service: "git-pulse-server",
      database: dbStatus,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
    };
  }
}
