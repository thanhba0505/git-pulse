import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { CommonModule } from "./common/common.module";
import { AuthModule } from "./auth/auth.module";
import { GitHubModule } from "./github/github.module";
import { AiModule } from "./ai/ai.module";
import { ReportsModule } from "./reports/reports.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    PrismaModule,
    CommonModule,
    AuthModule,
    GitHubModule,
    AiModule,
    ReportsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
