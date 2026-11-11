import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix("api/v1");

  // Middlewares
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS
  const clientOrigin = process.env.CORS_ORIGIN || "http://localhost:6100";
  app.enableCors({
    origin: [clientOrigin, "http://127.0.0.1:6100"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  });

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle("Git Pulse API")
    .setDescription(
      "Developer Intelligence & Git Workspace API with Dual-Core AI and GitHub Integration.",
    )
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT || 6101;
  await app.listen(port);
  console.log(`🌌 Git Pulse Server running on http://localhost:${port}/api/v1`);
  console.log(
    `📡 Swagger documentation available on http://localhost:${port}/api/docs`,
  );
}

bootstrap();
