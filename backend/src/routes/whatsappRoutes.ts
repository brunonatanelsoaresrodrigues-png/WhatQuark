import express from "express";
import isAuth from "../middleware/isAuth";
import isAdmin from "../middleware/isAdmin";

import * as WhatsAppController from "../controllers/WhatsAppController";

const whatsappRoutes = express.Router();

whatsappRoutes.get("/whatsapp/", isAuth, WhatsAppController.index);

whatsappRoutes.post("/whatsapp/", isAuth, isAdmin, WhatsAppController.store);

whatsappRoutes.get(
  "/whatsapp/:whatsappId",
  isAuth,
  isAdmin,
  WhatsAppController.show
);

whatsappRoutes.put(
  "/whatsapp/:whatsappId",
  isAuth,
  isAdmin,
  WhatsAppController.update
);

whatsappRoutes.get(
  "/whatsapp/:whatsappId/history-sync",
  isAuth,
  isAdmin,
  WhatsAppController.historySyncStatus
);
whatsappRoutes.post(
  "/whatsapp/:whatsappId/history-sync",
  isAuth,
  isAdmin,
  WhatsAppController.syncHistory
);

whatsappRoutes.delete(
  "/whatsapp/:whatsappId",
  isAuth,
  isAdmin,
  WhatsAppController.remove
);

export default whatsappRoutes;
