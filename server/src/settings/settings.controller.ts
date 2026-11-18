import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('User Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user fetch & display preferences' })
  async getSettings(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.settingsService.getSettings(req.user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update user fetch & display preferences' })
  async updateSettings(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.settingsService.updateSettings(req.user.id, dto);
  }
}
