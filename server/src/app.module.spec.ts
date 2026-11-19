import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

describe('AppModule DI Graph', () => {
  it('resolves all modules, controllers, guards, and services cleanly', async () => {
    const prismaStub = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
      serviceConnection: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
