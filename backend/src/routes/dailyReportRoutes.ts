import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as DailyReportController from "../controllers/DailyReportController";

const routes = Router();
routes.get("/daily-reports", isAuth, DailyReportController.overview);
routes.post(
  "/daily-reports/recipients",
  isAuth,
  DailyReportController.createRecipient
);
routes.put(
  "/daily-reports/recipients/:id",
  isAuth,
  DailyReportController.updateRecipient
);
routes.post(
  "/daily-reports/recipients/:id/verify",
  isAuth,
  DailyReportController.verifyRecipient
);
routes.post(
  "/daily-reports/recipients/:id/test",
  isAuth,
  DailyReportController.sendTest
);
routes.post("/daily-reports/preview", isAuth, DailyReportController.preview);
routes.get(
  "/daily-reports/runs/:id/csv",
  isAuth,
  DailyReportController.exportCsv
);
routes.post(
  "/daily-reports/deliveries/:id/retry",
  isAuth,
  DailyReportController.retryDelivery
);

export default routes;
