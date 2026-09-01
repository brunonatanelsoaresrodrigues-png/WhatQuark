import { Router } from "express";
import isAuth from "../middleware/isAuth";
import isAdmin from "../middleware/isAdmin";
import canAccessTicket from "../middleware/canAccessTicket";
import * as controller from "../controllers/MessagingController";
const routes = Router();
routes.get("/messaging/status", isAuth, controller.status);
routes.get("/messaging/outbox", isAuth, isAdmin, controller.outbox);
routes.post("/messaging/pause", isAuth, isAdmin, controller.pause);
routes.get(
  "/tickets/:ticketId/context",
  isAuth,
  canAccessTicket,
  controller.context
);
routes.put(
  "/tickets/:ticketId/preference",
  isAuth,
  canAccessTicket,
  controller.preference
);
routes.put("/tickets/:ticketId/bot", isAuth, canAccessTicket, controller.bot);
routes.post(
  "/quark/dashboard/appointments/:appointmentId/reconcile",
  isAuth,
  isAdmin,
  controller.reconcileQuark
);
routes.get(
  "/quark/dashboard/appointments/:appointmentId/reminder-preview",
  isAuth,
  isAdmin,
  controller.reminderPreview
);
export default routes;
