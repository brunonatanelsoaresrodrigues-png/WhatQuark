import "./bootstrap";
import "reflect-metadata";
import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import multer from "multer";
import * as Sentry from "@sentry/node";

import "./database";
import isAuth from "./middleware/isAuth";
import * as MediaController from "./controllers/MediaController";
import AppError from "./errors/AppError";
import routes from "./routes";
import cloudWebhook from "./services/MessagingServices/cloudWebhook";
import { logger } from "./utils/logger";
import securityHeaders from "./middleware/securityHeaders";
import sequelize from "./database";

Sentry.init({ dsn: process.env.SENTRY_DSN });

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(securityHeaders);

app.use(
  cors({
    credentials: true,
    origin: process.env.FRONTEND_URL
  })
);
app.use(cookieParser());
app.use(cloudWebhook);
app.use(express.json());
app.use(Sentry.Handlers.requestHandler());
app.get("/health", async (_req, res) => {
  await sequelize.authenticate();
  return res.status(200).json({ status: "ok" });
});
app.get("/public/:filename", isAuth, MediaController.show);
app.use(routes);

app.use(Sentry.Handlers.errorHandler());

app.use(async (err: Error, req: Request, res: Response, _: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? "ERR_MEDIA_TOO_LARGE" : "ERR_INVALID_MEDIA"
    });
  }
  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error({ error: err.message });
    else logger.warn({ error: err.message, statusCode: err.statusCode });
    return res.status(err.statusCode).json({ error: err.message });
  }

  logger.error(err);
  return res.status(500).json({ error: "Internal server error" });
});

export default app;
