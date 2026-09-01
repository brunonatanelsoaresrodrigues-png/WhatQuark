import { Request, Response } from "express";
import AppError from "../errors/AppError";
import ListIdentityIssuesService from "../services/IdentityServices/ListIdentityIssuesService";
import ReconcileContactIdentitiesService from "../services/IdentityServices/ReconcileContactIdentitiesService";
import ResolveIdentityIssueService from "../services/IdentityServices/ResolveIdentityIssueService";
import { identityCenterEnabled } from "../services/IdentityServices/config";

const assertEnabled = () => {
  if (!identityCenterEnabled()) throw new AppError("ERR_IDENTITY_CENTER_DISABLED", 404);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  assertEnabled();
  const data = await ListIdentityIssuesService({
    status: String(req.query.status || "OPEN"),
    type: String(req.query.type || ""),
    pageNumber: String(req.query.pageNumber || "1"),
    search: String(req.query.search || "")
  });
  return res.json(data);
};

export const reconcile = async (req: Request, res: Response): Promise<Response> => {
  assertEnabled();
  const contactId = req.body?.contactId ? Number(req.body.contactId) : undefined;
  const result = await ReconcileContactIdentitiesService(contactId);
  return res.status(202).json(result);
};

export const resolve = async (req: Request, res: Response): Promise<Response> => {
  assertEnabled();
  const issueId = Number(req.params.issueId);
  if (!Number.isInteger(issueId) || issueId <= 0)
    throw new AppError("ERR_IDENTITY_ISSUE_NOT_FOUND", 404);
  const action = String(req.body?.action || "").toUpperCase();
  if (!["CONFIRM_PATIENT", "KEEP_SEPARATE", "IGNORE", "RECHECK"].includes(action))
    throw new AppError("ERR_IDENTITY_INVALID_ACTION", 400);
  const issue = await ResolveIdentityIssueService({
    issueId,
    action: action as "CONFIRM_PATIENT" | "KEEP_SEPARATE" | "IGNORE" | "RECHECK",
    patientId: req.body?.patientId,
    userId: Number(req.user.id)
  });
  return res.json(issue);
};
