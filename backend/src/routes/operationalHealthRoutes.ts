import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as OperationalHealthController from "../controllers/OperationalHealthController";

const routes = Router();

routes.get("/health", OperationalHealthController.liveness);
routes.get("/ready", OperationalHealthController.readiness);
routes.get(
  "/operational-health",
  isAuth,
  OperationalHealthController.overview
);
routes.put(
  "/operational-health/alerts/:id/acknowledge",
  isAuth,
  OperationalHealthController.acknowledge
);

export default routes;
