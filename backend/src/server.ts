import gracefulShutdown from "http-graceful-shutdown";
import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { beginShutdown } from "./utils/shutdownState";
import { closeRedis, initRedis } from "./libs/redisStore";
import {
  whatsappProvider,
  StartOutboundDispatcher,
  StopOutboundDispatcher
} from "./providers/WhatsApp";
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
  StartCloudWebhookWorker,
  StopCloudWebhookWorker
} from "./services/MessagingServices/cloudWebhook";
import {
  StartIdentityReconciliationWorker,
  StopIdentityReconciliationWorker
} from "./services/IdentityServices/IdentityReconciliationWorker";
import {
  startOperationalHealthWorker,
  stopOperationalHealthWorker
} from "./services/OperationalHealthServices/OperationalHealthWorker";

const server = app.listen(process.env.PORT, () => {
  logger.info(`Server started on port: ${process.env.PORT}`);
});

initIO(server);
initRedis();
StartOutboundDispatcher();
StartCloudWebhookWorker();
StartAllWhatsAppsSessions();
StartQuarkClinicIntegration();
StartTicketInactivityWorker();
StartDailyManagementReportWorker();
StartIdentityReconciliationWorker();
startOperationalHealthWorker();
gracefulShutdown(server, {
  timeout: 180000,
  onShutdown: async signal => {
    logger.info({ info: "Graceful shutdown started", signal });
    beginShutdown();
    await Promise.all([
      StopTicketInactivityWorker(),
      StopDailyManagementReportWorker(),
      StopIdentityReconciliationWorker(),
      stopOperationalHealthWorker(),
      StopQuarkClinicIntegration(),
      StopCloudWebhookWorker(),
      StopOutboundDispatcher()
    ]);
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
