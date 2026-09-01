import { Router } from "express";
import * as SessionController from "../controllers/SessionController";
import * as UserController from "../controllers/UserController";
import isAuth from "../middleware/isAuth";
import loginRateLimit from "../middleware/loginRateLimit";

const authRoutes = Router();

authRoutes.post("/signup", UserController.signup);

authRoutes.post("/login", loginRateLimit, SessionController.store);

authRoutes.post("/refresh_token", SessionController.update);

authRoutes.delete("/logout", isAuth, SessionController.remove);

export default authRoutes;
