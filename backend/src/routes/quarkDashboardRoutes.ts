import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as QuarkDashboardController from "../controllers/QuarkDashboardController";

const quarkDashboardRoutes = Router();

quarkDashboardRoutes.get(
  "/quark/dashboard/summary",
  isAuth,
  QuarkDashboardController.summary
);
quarkDashboardRoutes.get(
  "/quark/dashboard/timeseries",
  isAuth,
  QuarkDashboardController.timeseries
);
quarkDashboardRoutes.get(
  "/quark/dashboard/breakdown",
  isAuth,
  QuarkDashboardController.breakdown
);
quarkDashboardRoutes.get(
  "/quark/dashboard/appointments",
  isAuth,
  QuarkDashboardController.appointments
);
quarkDashboardRoutes.post(
  "/quark/dashboard/appointments/:appointmentId/reminder",
  isAuth,
  QuarkDashboardController.enqueueReminder
);
quarkDashboardRoutes.post(
  "/quark/dashboard/appointments/:appointmentId/confirm",
  isAuth,
  QuarkDashboardController.confirmAppointment
);

export default quarkDashboardRoutes;
