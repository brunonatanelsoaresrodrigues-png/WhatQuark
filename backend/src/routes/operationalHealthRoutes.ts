import { Router } from "express";
import * as OperationalHealthController from "../controllers/OperationalHealthController";
import isAuth from "../middleware/isAuth";
import isAdmin from "../middleware/isAdmin";

const routes = Router();
routes.get("/admin/operations/health", isAuth, isAdmin, OperationalHealthController.show);
routes.post("/admin/operations/health/recheck", isAuth, isAdmin, OperationalHealthController.show);
routes.post("/admin/operations/incidents/:incidentId/acknowledge", isAuth, isAdmin, OperationalHealthController.acknowledge);

export default routes;
