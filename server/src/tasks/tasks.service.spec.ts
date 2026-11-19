import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  let prismaMock: {
    trackingTask: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
    };
    trackingTaskItem: {
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      trackingTask: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      trackingTaskItem: {
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock)),
    };

    service = new TasksService(prismaMock as unknown as PrismaService);
  });

  it('rejects creating a task with blank title', async () => {
    await expect(service.createTask('user-1', { title: '   ' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('deduplicates manual PR items when creating a tracking task', async () => {
    prismaMock.trackingTask.create.mockResolvedValue({
      id: 'task-1',
      title: 'SSO Rollout',
      color: 'sky',
      items: [],
    });

    await service.createTask('user-1', {
      title: '  SSO Rollout  ',
      color: 'indigo',
      items: [
        {
          repo: 'nanocohub/gateway',
          prNumber: 14,
          title: 'feat: pkce',
          prUrl: 'https://github.com/nanocohub/gateway/pull/14',
          state: 'draft',
          ownerType: 'organization',
        },
        {
          repo: 'nanocohub/gateway',
          prNumber: 14,
          title: 'feat: pkce updated',
          prUrl: 'https://github.com/nanocohub/gateway/pull/14',
          state: 'open',
          ownerType: 'organization',
        },
      ],
    });

    expect(prismaMock.trackingTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          title: 'SSO Rollout',
          color: 'indigo',
          items: {
            create: [
              expect.objectContaining({
                repo: 'nanocohub/gateway',
                prNumber: 14,
                title: 'feat: pkce updated',
                state: 'open',
              }),
            ],
          },
        }),
      }),
    );
  });

  it('throws NotFoundException when deleting another user task', async () => {
    prismaMock.trackingTask.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.deleteTask('user-1', 'task-other')).rejects.toThrow(NotFoundException);
  });

  it('upserts PR items idempotently into an owned task', async () => {
    prismaMock.trackingTask.findFirst.mockResolvedValue({ id: 'task-1', userId: 'user-1' });
    prismaMock.trackingTask.findUnique.mockResolvedValue({ id: 'task-1', items: [] });

    await service.addItems('user-1', 'task-1', [
      {
        repo: 'thanhba/git-pulse',
        prNumber: 8,
        title: 'feat: direct commits',
        prUrl: 'https://github.com/thanhba/git-pulse/pull/8',
        state: 'merged',
        ownerType: 'personal',
      },
    ]);

    expect(prismaMock.trackingTaskItem.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.trackingTask.update).toHaveBeenCalled();
  });

  it('marks a task completed with completedAt timestamp and clears completedAt when reopened', async () => {
    prismaMock.trackingTask.findFirst.mockResolvedValue({ id: 'task-1', userId: 'user-1' });
    prismaMock.trackingTask.update.mockResolvedValue({
      id: 'task-1',
      isCompleted: true,
      items: [],
    });

    await service.updateTask('user-1', 'task-1', { isCompleted: true });

    expect(prismaMock.trackingTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          isCompleted: true,
          completedAt: expect.any(Date),
        }),
      }),
    );

    prismaMock.trackingTask.update.mockClear();
    await service.updateTask('user-1', 'task-1', { isCompleted: false });

    expect(prismaMock.trackingTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          isCompleted: false,
          completedAt: null,
        }),
      }),
    );
  });

  it('throws NotFoundException when updating another user task', async () => {
    prismaMock.trackingTask.findFirst.mockResolvedValue(null);
    await expect(service.updateTask('user-1', 'task-other', { isCompleted: true })).rejects.toThrow(
      NotFoundException,
    );
  });
});
