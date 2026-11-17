import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import express, { Express, Request, Response } from "express";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/main";

let cachedServer: Express;

async function bootstrapServer(): Promise<Express> {
  if (!cachedServer) {
    const expressApp = express();
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
    );
    configureApp(app);
    await app.init();
    cachedServer = expressApp;
  }
  return cachedServer;
}

export default async function handler(req: Request, res: Response) {
  const server = await bootstrapServer();
  return server(req, res);
}
