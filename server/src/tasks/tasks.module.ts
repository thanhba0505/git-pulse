import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GitHubModule } from '../github/github.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [AuthModule, GitHubModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
