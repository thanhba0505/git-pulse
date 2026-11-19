import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto, TaskItemInputDto, UpdateTaskDto } from './dto/task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async listTasks(userId: string) {
    return this.prisma.trackingTask.findMany({
      where: { userId },
      include: {
        items: {
          orderBy: { addedAt: 'asc' },
        },
      },
      orderBy: [{ isCompleted: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async createTask(userId: string, dto: CreateTaskDto) {
    const cleanTitle = dto.title.trim();
    if (!cleanTitle) {
      throw new BadRequestException('Tên Task không được để trống.');
    }

    const dedupedItems = this.dedupeItems(dto.items ?? []);

    return this.prisma.trackingTask.create({
      data: {
        userId,
        title: cleanTitle,
        color: dto.color ?? 'sky',
        ...(dedupedItems.length > 0
          ? {
              items: {
                create: dedupedItems.map((item) => ({
                  repo: item.repo.trim(),
                  prNumber: item.prNumber,
                  title: item.title.trim().slice(0, 300),
                  prUrl: item.prUrl.trim().slice(0, 500),
                  state: item.state ?? 'open',
                  ownerType: item.ownerType ?? 'personal',
                })),
              },
            }
          : {}),
      },
      include: {
        items: {
          orderBy: { addedAt: 'asc' },
        },
      },
    });
  }

  async updateTask(userId: string, taskId: string, dto: UpdateTaskDto) {
    const existing = await this.prisma.trackingTask.findFirst({
      where: { id: taskId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy Task theo dõi.');
    }

    const cleanTitle = dto.title?.trim();
    if (dto.title !== undefined && !cleanTitle) {
      throw new BadRequestException('Tên Task không được để trống.');
    }

    const updateData: {
      title?: string;
      color?: string;
      isCompleted?: boolean;
      completedAt?: Date | null;
    } = {};

    if (cleanTitle) {
      updateData.title = cleanTitle;
    }
    if (dto.color !== undefined) {
      updateData.color = dto.color;
    }
    if (dto.isCompleted !== undefined) {
      updateData.isCompleted = dto.isCompleted;
      updateData.completedAt = dto.isCompleted ? new Date() : null;
    }

    return this.prisma.trackingTask.update({
      where: { id: taskId },
      data: updateData,
      include: {
        items: {
          orderBy: { addedAt: 'asc' },
        },
      },
    });
  }

  async deleteTask(userId: string, taskId: string) {
    const result = await this.prisma.trackingTask.deleteMany({
      where: { id: taskId, userId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Không tìm thấy Task theo dõi.');
    }
    return { success: true };
  }

  async addItems(userId: string, taskId: string, items: TaskItemInputDto[]) {
    const existing = await this.prisma.trackingTask.findFirst({
      where: { id: taskId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy Task theo dõi.');
    }

    const dedupedItems = this.dedupeItems(items);

    await this.prisma.$transaction(async (tx) => {
      for (const item of dedupedItems) {
        const repo = item.repo.trim();
        await tx.trackingTaskItem.upsert({
          where: {
            taskId_repo_prNumber: {
              taskId,
              repo,
              prNumber: item.prNumber,
            },
          },
          update: {
            title: item.title.trim().slice(0, 300),
            prUrl: item.prUrl.trim().slice(0, 500),
            state: item.state ?? 'open',
            ownerType: item.ownerType ?? 'personal',
          },
          create: {
            taskId,
            repo,
            prNumber: item.prNumber,
            title: item.title.trim().slice(0, 300),
            prUrl: item.prUrl.trim().slice(0, 500),
            state: item.state ?? 'open',
            ownerType: item.ownerType ?? 'personal',
          },
        });
      }

      await tx.trackingTask.update({
        where: { id: taskId },
        data: { updatedAt: new Date() },
      });
    });

    return this.prisma.trackingTask.findUnique({
      where: { id: taskId },
      include: {
        items: {
          orderBy: { addedAt: 'asc' },
        },
      },
    });
  }

  async removeItem(userId: string, taskId: string, repo: string, prNumber: number) {
    const existing = await this.prisma.trackingTask.findFirst({
      where: { id: taskId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy Task theo dõi.');
    }

    await this.prisma.trackingTaskItem.deleteMany({
      where: {
        taskId,
        repo,
        prNumber,
      },
    });

    return this.prisma.trackingTask.findUnique({
      where: { id: taskId },
      include: {
        items: {
          orderBy: { addedAt: 'asc' },
        },
      },
    });
  }

  private dedupeItems(items: TaskItemInputDto[]): TaskItemInputDto[] {
    const map = new Map<string, TaskItemInputDto>();
    for (const item of items) {
      const key = `${item.repo.trim()}#${item.prNumber}`;
      map.set(key, item);
    }
    return Array.from(map.values());
  }
}
