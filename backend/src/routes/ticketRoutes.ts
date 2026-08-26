import express from "express";
import isAuth from "../middleware/isAuth";

import * as TicketController from "../controllers/TicketController";

const ticketRoutes = express.Router();

ticketRoutes.get("/tickets", isAuth, TicketController.index);

ticketRoutes.get("/tickets/:ticketId", isAuth, TicketController.show);

ticketRoutes.post("/tickets", isAuth, TicketController.store);

ticketRoutes.put("/tickets/:ticketId", isAuth, TicketController.update);

ticketRoutes.post(
  "/tickets/:ticketId/awaiting-patient",
  isAuth,
  TicketController.setWaitingForPatient
);

ticketRoutes.post(
  "/tickets/:ticketId/intake/resume",
  isAuth,
  TicketController.resumePatientIntake
);

ticketRoutes.delete("/tickets/:ticketId", isAuth, TicketController.remove);

export default ticketRoutes;
