import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";

@ApiTags("Health & Telemetry")
@Controller("health")
export class HealthController {
  @Get()
  @ApiOperation({ summary: "Health check probe" })
  check() {
    return {
      status: "ok",
      service: "git-pulse-server",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
    };
  }
}
