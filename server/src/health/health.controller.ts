import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';
import { FullHealthResponseDto, HealthResponseDto } from './dto/health-response.dto';

@ApiTags('Health & Telemetry')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lightweight liveness health probe (no database query)' })
  @ApiOkResponse({
    description: 'Service process is alive',
    type: HealthResponseDto,
  })
  check(): HealthResponseDto {
    return this.healthService.check();
  }

  @Get('health-full')
  @ApiOperation({
    summary: 'Full readiness check verifying local database and connected peer services',
  })
  @ApiOkResponse({
    description:
      'Service and database are healthy (returns 200 even if a peer service is unreachable)',
    type: FullHealthResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'Service or database connectivity failed',
    type: FullHealthResponseDto,
  })
  async checkFull(@Res({ passthrough: true }) res?: Response): Promise<FullHealthResponseDto> {
    const result = await this.healthService.checkFull();
    res?.status(result.database === 'connected' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
