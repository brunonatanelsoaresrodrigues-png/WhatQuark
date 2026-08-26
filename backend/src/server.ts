import gracefulShutdown from "http-graceful-shutdown";
import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { closeRedis, initRedis } from "./libs/redisStore";
import { whatsappProvider } from "./providers/WhatsApp";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";
import StartQuarkClinicIntegration, {
  StopQuarkClinicIntegration
} from "./services/QuarkClinicServices/StartQuarkClinicIntegration";
import {
  StartTicketInactivityWorker,
  StopTicketInactivityWorker
} from "./services/TicketInactivityServices/TicketInactivityWorker";
import {
  StartDailyManagementReportWorker,
  StopDailyManagementReportWorker
} from "./services/DailyReportServices/DailyManagementReportWorker";
import {
  StartOperationalHealthWorker,
  StopOperationalHealthWorker
} from "./services/OperationalHealthServices/OperationalHealthWorker";

const server = app.listen(process.env.PORT, () => {
  logger.info(`Server started on port: ${process.env.PORT}`);
});

initIO(server);
initRedis();
StartAllWhatsAppsSessions();
StartQuarkClinicIntegration();
StartTicketInactivityWorker();
StartDailyManagementReportWorker();
StartOperationalHealthWorker();
gracefulShutdown(server, {
  timeout: 30000,
  onShutdown: async signal => {
    logger.info({ info: "Graceful shutdown started", signal });
    await StopTicketInactivityWorker();
    await StopDailyManagementReportWorker();
    await StopOperationalHealthWorker();
    await StopQuarkClinicIntegration();
    await whatsappProvider.shutdown();
    await closeRedis();
    logger.info("Graceful shutdown completed");
  }
});

process.on("uncaughtException", err => {
  logger.error({ info: "Global uncaught exception", err });
});

process.on("unhandledRejection", err => {
  if (err) logger.error({ info: "Global unhandled rejection", err });
});
