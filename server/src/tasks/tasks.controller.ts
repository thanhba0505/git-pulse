import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddTaskItemsDto, CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

@ApiTags('Tracking Tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'List manual PR tracking tasks' })
  async listTasks(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.tasksService.listTasks(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a manual tracking task' })
  async createTask(@Req() req: Request & { user: AuthenticatedUser }, @Body() dto: CreateTaskDto) {
    return this.tasksService.createTask(req.user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a manual tracking task' })
  async updateTask(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.updateTask(req.user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a manual tracking task' })
  async deleteTask(@Req() req: Request & { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.tasksService.deleteTask(req.user.id, id);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Assign PR(s) to a manual tracking task' })
  async addItems(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: AddTaskItemsDto,
  ) {
    return this.tasksService.addItems(req.user.id, id, dto.items);
  }

  @Delete(':id/items')
  @ApiOperation({ summary: 'Remove a PR from a manual tracking task' })
  async removeItem(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id') id: string,
    @Query('repo') repo: string,
    @Query('prNumber', ParseIntPipe) prNumber: number,
  ) {
    return this.tasksService.removeItem(req.user.id, id, repo, prNumber);
  }
}
