import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as StickerController from "../controllers/StickerController";

const stickerRoutes = Router();

stickerRoutes.get("/stickers", isAuth, StickerController.index);
stickerRoutes.post("/stickers", isAuth, StickerController.store);
stickerRoutes.get(
  "/stickers/:stickerId/media",
  isAuth,
  StickerController.showMedia
);
stickerRoutes.post(
  "/stickers/:stickerId/send/:ticketId",
  isAuth,
  StickerController.send
);
stickerRoutes.delete("/stickers/:stickerId", isAuth, StickerController.remove);

export default stickerRoutes;
