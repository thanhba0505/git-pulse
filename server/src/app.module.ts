import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { CommonModule } from "./common/common.module";
import { S2SModule } from "./s2s/s2s.module";
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
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100, // General rate limit: 100 req/min
      },
    ]),
    PrismaModule,
    CommonModule,
    S2SModule,
    AuthModule,
    GitHubModule,
    AiModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
