import express from "express";
import isAuth from "../middleware/isAuth";
import canAccessTicket from "../middleware/canAccessTicket";
import isAdmin from "../middleware/isAdmin";

import * as TicketController from "../controllers/TicketController";
import * as AiAssistantController from "../controllers/AiAssistantController";

import * as TicketMetricsController from "../controllers/TicketMetricsController";
const ticketRoutes = express.Router();
ticketRoutes.get(
  "/ticket-metrics/operations",
  isAuth,
  TicketMetricsController.operations
);
ticketRoutes.get(
  "/ticket-metrics/daily",
  isAuth,
  TicketMetricsController.daily
);

ticketRoutes.get("/tickets", isAuth, TicketController.index);

ticketRoutes.get(
  "/tickets/:ticketId",
  isAuth,
  canAccessTicket,
  TicketController.show
);

ticketRoutes.get("/tickets/:ticketId/assistant/status", isAuth, canAccessTicket, AiAssistantController.status);
ticketRoutes.post("/tickets/:ticketId/assistant/suggestions", isAuth, canAccessTicket, AiAssistantController.generate);
ticketRoutes.patch("/tickets/:ticketId/assistant/suggestions/:suggestionId", isAuth, canAccessTicket, AiAssistantController.update);

ticketRoutes.post("/tickets", isAuth, TicketController.store);

ticketRoutes.put(
  "/tickets/:ticketId",
  isAuth,
  canAccessTicket,
  TicketController.update
);

ticketRoutes.post(
  "/tickets/:ticketId/awaiting-patient",
  isAuth,
  canAccessTicket,
  TicketController.setWaitingForPatient
);

ticketRoutes.delete(
  "/tickets/:ticketId",
  isAuth,
  isAdmin,
  canAccessTicket,
  TicketController.remove
);

export default ticketRoutes;
