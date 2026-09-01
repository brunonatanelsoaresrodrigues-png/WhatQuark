import express from "express";
import isAuth from "../middleware/isAuth";
import isAdmin from "../middleware/isAdmin";
import * as IdentityController from "../controllers/IdentityController";

const identityRoutes = express.Router();
identityRoutes.get("/contacts/identity/issues", isAuth, isAdmin, IdentityController.index);
identityRoutes.post("/contacts/identity/reconcile", isAuth, isAdmin, IdentityController.reconcile);
identityRoutes.post("/contacts/identity/issues/:issueId/resolve", isAuth, isAdmin, IdentityController.resolve);

export default identityRoutes;
