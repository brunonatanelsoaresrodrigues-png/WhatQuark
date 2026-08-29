import { Router } from "express";

import isAuth from "../middleware/isAuth";
import * as UserController from "../controllers/UserController";
import multer from "multer";

const userRoutes = Router();
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }
});

userRoutes.get("/users", isAuth, UserController.index);

userRoutes.get("/users/assignees", isAuth, UserController.assignees);

userRoutes.get("/users/:userId/avatar", isAuth, UserController.showAvatar);

userRoutes.post(
  "/users/:userId/avatar",
  isAuth,
  avatarUpload.single("avatar"),
  UserController.storeAvatar
);

userRoutes.delete("/users/:userId/avatar", isAuth, UserController.removeAvatar);

userRoutes.post("/users", isAuth, UserController.store);

userRoutes.put("/users/:userId", isAuth, UserController.update);

userRoutes.get("/users/:userId", isAuth, UserController.show);

userRoutes.delete("/users/:userId", isAuth, UserController.remove);

export default userRoutes;
