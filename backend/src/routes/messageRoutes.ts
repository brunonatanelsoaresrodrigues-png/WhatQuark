import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import canAccessTicket from "../middleware/canAccessTicket";
import uploadConfig from "../config/upload";

import * as MessageController from "../controllers/MessageController";

const messageRoutes = Router();

const upload = multer(uploadConfig);

messageRoutes.get(
  "/messages/:ticketId/search",
  isAuth,
  canAccessTicket,
  MessageController.search
);

messageRoutes.get(
  "/messages/:ticketId/context/:messageId",
  isAuth,
  canAccessTicket,
  MessageController.context
);

messageRoutes.get(
  "/messages/:ticketId",
  isAuth,
  canAccessTicket,
  MessageController.index
);

messageRoutes.post(
  "/messages/:ticketId",
  isAuth,
  canAccessTicket,
  upload.array("medias"),
  MessageController.store
);

messageRoutes.delete("/messages/:messageId", isAuth, MessageController.remove);
messageRoutes.patch("/messages/:messageId", isAuth, MessageController.edit);

export default messageRoutes;
