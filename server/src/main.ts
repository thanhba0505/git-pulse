import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { APP_VERSION } from './common/version';
import { AppModule } from './app.module';

export function configureApp(app: INestApplication): void {
  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Middlewares
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS configuration
  const defaultOrigins = [
    'http://localhost:6100',
    'http://127.0.0.1:6100',
    'http://localhost:5100',
    'http://localhost:4100',
    'https://git-pulse-client.vercel.app',
    'https://git-pulse-app.vercel.app',
    'https://git-pulse-web.vercel.app',
    'https://central-gateway-client.vercel.app',
    'https://central-gateway-app.vercel.app',
    'https://wonderlab-client.vercel.app',
    'https://wonderlab-app.vercel.app',
    'https://wonderlab.io.vn',
    'https://www.wonderlab.io.vn',
  ];

  const configuredOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : [];

  const corsOrigins = Array.from(new Set([...defaultOrigins, ...configuredOrigins]));

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-S2S-Service',
      'X-S2S-Timestamp',
      'X-S2S-Signature',
    ],
  });

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Git Pulse API')
    .setDescription(
      'Developer Intelligence & Git Workspace API with Dual-Core AI and GitHub Integration.',
    )
    .setVersion(APP_VERSION)
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const swaggerUiCdn = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2';
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Git Pulse API Docs',
    ...(process.env.VERCEL
      ? {
          customCssUrl: `${swaggerUiCdn}/swagger-ui.css`,
          customJs: [
            `${swaggerUiCdn}/swagger-ui-bundle.js`,
            `${swaggerUiCdn}/swagger-ui-standalone-preset.js`,
          ],
          customfavIcon: `${swaggerUiCdn}/favicon-32x32.png`,
        }
      : {}),
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const port = process.env.PORT || 6101;
  await app.listen(port);
  console.log(`🌌 Git Pulse Server running on http://localhost:${port}/api/v1`);
  console.log(`📡 Swagger documentation available on http://localhost:${port}/api/docs`);
}

if (!process.env.VERCEL) {
  bootstrap();
}
