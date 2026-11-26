import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { GitHubModule } from '../github/github.module';
import { ParabolModule } from '../parabol/parabol.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsModule } from '../reports/reports.module';
import { SettingsModule } from '../settings/settings.module';
import { TasksModule } from '../tasks/tasks.module';
import { McpAuthGuard } from './mcp-auth.guard';
import { McpController } from './mcp.controller';
import { McpKeysController } from './mcp-keys.controller';
import { McpKeysService } from './mcp-keys.service';
import { McpServerFactory } from './mcp-server.factory';
import { McpToolsService } from './mcp-tools.service';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    AuthModule,
    GitHubModule,
    AiModule,
    TasksModule,
    ReportsModule,
    SettingsModule,
    ParabolModule,
  ],
  controllers: [McpKeysController, McpController],
  providers: [McpKeysService, McpAuthGuard, McpToolsService, McpServerFactory],
  exports: [McpKeysService],
})
export class McpModule {}
