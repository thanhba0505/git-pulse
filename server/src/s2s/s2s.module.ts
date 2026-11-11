import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { S2SService } from "./s2s.service";
import { S2SAuthGuard } from "./s2s-auth.guard";

@Module({
  imports: [PrismaModule],
  providers: [S2SService, S2SAuthGuard],
  exports: [S2SService, S2SAuthGuard],
})
export class S2SModule {}
