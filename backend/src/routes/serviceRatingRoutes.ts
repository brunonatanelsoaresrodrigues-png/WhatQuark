import { Router } from "express";
import isAuth from "../middleware/isAuth";
import isAdmin from "../middleware/isAdmin";
import * as controller from "../controllers/ServiceRatingController";

const routes = Router();
routes.get("/service-ratings/summary", isAuth, isAdmin, controller.summary);
routes.get("/service-ratings", isAuth, isAdmin, controller.index);
routes.get("/service-ratings/users/:userId", isAuth, controller.userSummary);

export default routes;
