import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ParabolClient } from './parabol.client';
import { ParabolController } from './parabol.controller';
import { ParabolService } from './parabol.service';

@Module({
  imports: [PrismaModule, CommonModule, AuthModule],
  controllers: [ParabolController],
  providers: [ParabolClient, ParabolService],
  exports: [ParabolService],
})
export class ParabolModule {}
