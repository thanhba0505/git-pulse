import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateParabolConnectionDto,
  SubmitParabolStandupDto,
  VerifyParabolTokenDto,
} from './dto/parabol.dto';
import { ParabolService } from './parabol.service';

@ApiTags('Parabol Integration')
@Controller('parabol')
@UseGuards(JwtAuthGuard)
export class ParabolController {
  constructor(private readonly parabolService: ParabolService) {}

  @Get('connections')
  @ApiOperation({ summary: 'List user Parabol PAT connections (masked prefixes only)' })
  async listConnections(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.parabolService.listConnections(req.user.id);
  }

  @Post('verify-token')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Validate an unsaved Parabol PAT and return profile info' })
  async verifyToken(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: VerifyParabolTokenDto,
  ) {
    return this.parabolService.verifyToken(req.user.id, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('connections')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify and store encrypted Parabol Personal Access Token' })
  async saveConnection(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: CreateParabolConnectionDto,
  ) {
    return this.parabolService.saveConnection(req.user.id, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch('connections/:id/active')
  @ApiOperation({ summary: 'Switch active Parabol connection for the user' })
  async switchActiveConnection(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.parabolService.switchActiveConnection(req.user.id, id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete('connections/:id')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Delete a saved Parabol PAT connection' })
  async deleteConnection(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.parabolService.deleteConnection(req.user.id, id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('standups')
  @ApiOperation({ summary: 'List active Parabol Standup (TeamPromptMeeting) instances' })
  async listActiveStandups(
    @Req() req: Request & { user: AuthenticatedUser },
    @Query('connectionId') connectionId?: string,
    @Query('meetingUrl') meetingUrl?: string,
    @Query('refresh') refresh?: string,
  ) {
    return this.parabolService.listActiveStandups(
      req.user.id,
      { connectionId, meetingUrl, forceRefresh: refresh === 'true' },
      {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    );
  }

  @Post('standups/submit')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Submit standup bullets directly to a Parabol Standup meeting prompt' })
  async submitStandup(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: SubmitParabolStandupDto,
  ) {
    return this.parabolService.submitStandup(req.user.id, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
