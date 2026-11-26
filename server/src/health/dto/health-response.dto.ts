import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', description: 'Lightweight service liveness status (ok)' })
  status!: string;

  @ApiProperty({ example: 'git-pulse-server', description: 'Name of the microservice' })
  service!: string;

  @ApiProperty({
    example: '2026-11-26T12:00:00.000Z',
    description: 'Current server time in ISO-8601 format',
  })
  timestamp!: string;

  @ApiProperty({ example: '0.10.0', description: 'API contract version' })
  version!: string;

  @ApiPropertyOptional({
    example: 'a42f0ee',
    description: 'Deployed Git commit SHA',
  })
  commit?: string;
}

export class ServiceConnectionHealthDto {
  @ApiProperty({ example: 'central-gateway', description: 'Connected service slug' })
  slug!: string;

  @ApiProperty({ example: 'Central Gateway & IAM Master', description: 'Connected service name' })
  name!: string;

  @ApiProperty({
    example: 'http://localhost:5101/api/v1/health',
    description: 'Target health endpoint probed',
  })
  url!: string;

  @ApiProperty({
    example: 'connected',
    enum: ['connected', 'degraded', 'unreachable'],
    description: 'Connectivity status of the peer service',
  })
  status!: 'connected' | 'degraded' | 'unreachable';

  @ApiPropertyOptional({ example: 200, description: 'HTTP status returned by peer service' })
  httpStatus?: number;

  @ApiProperty({ example: 35, description: 'Probe latency in milliseconds' })
  latencyMs!: number;

  @ApiPropertyOptional({ example: 'HTTP 503', description: 'Sanitized error reason if failed' })
  error?: string;
}

export class FullHealthResponseDto {
  @ApiProperty({
    example: 'ok',
    enum: ['ok', 'degraded', 'error'],
    description:
      'Overall deep health status (ok = DB + peers ok, degraded = DB ok + peer issue, error = local DB failed)',
  })
  status!: 'ok' | 'degraded' | 'error';

  @ApiProperty({ example: 'git-pulse-server', description: 'Name of the microservice' })
  service!: string;

  @ApiProperty({
    example: 'connected',
    enum: ['connected', 'disconnected'],
    description: 'Local database connection status',
  })
  database!: 'connected' | 'disconnected';

  @ApiProperty({ example: 3, description: 'Database ping latency in milliseconds' })
  dbLatencyMs!: number;

  @ApiProperty({
    type: [ServiceConnectionHealthDto],
    description: 'Health checks for active peer connections in service_connections',
  })
  services!: ServiceConnectionHealthDto[];

  @ApiProperty({
    example: '2026-11-26T12:00:00.000Z',
    description: 'Current server time in ISO-8601 format',
  })
  timestamp!: string;

  @ApiProperty({ example: '0.10.0', description: 'API contract version' })
  version!: string;

  @ApiPropertyOptional({
    example: 'a42f0ee',
    description: 'Deployed Git commit SHA',
  })
  commit?: string;
}
