import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactIdentityAudit from "../../models/ContactIdentityAudit";
import ContactIdentityIssue from "../../models/ContactIdentityIssue";
import ContactQuarkLink from "../../models/ContactQuarkLink";
import { getIO } from "../../libs/socket";
import {
  findQuarkCandidates,
  safeJson,
  valueHash
} from "./identityEvidence";
import ReconcileContactIdentitiesService from "./ReconcileContactIdentitiesService";

type Action = "CONFIRM_PATIENT" | "KEEP_SEPARATE" | "IGNORE" | "RECHECK";

const ResolveIdentityIssueService = async ({
  issueId,
  action,
  patientId,
  userId
}: {
  issueId: number;
  action: Action;
  patientId?: string;
  userId: number;
}) => {
  const issue = await ContactIdentityIssue.findByPk(issueId, {
    include: [{ model: Contact }]
  });
  if (!issue?.contact) throw new AppError("ERR_IDENTITY_ISSUE_NOT_FOUND", 404);
  if (action === "RECHECK") {
    await ReconcileContactIdentitiesService(issue.contactId);
    return ContactIdentityIssue.findByPk(issueId, { include: [{ model: Contact }] });
  }
  const now = new Date();
  if (action === "CONFIRM_PATIENT") {
    if (!patientId) throw new AppError("ERR_QUARK_PATIENT_REQUIRED", 400);
    const candidates = await findQuarkCandidates(issue.contact);
    const candidate = candidates.find(item => item.patientId === patientId);
    if (!candidate) throw new AppError("ERR_QUARK_PATIENT_NOT_FOUND", 404);
    if (issue.contact.cpf && candidate.cpf && issue.contact.cpf !== candidate.cpf)
      throw new AppError("ERR_IDENTITY_CPF_CONFLICT", 409);
    const updates = {
      ...(!issue.contact.cpf && candidate.cpf ? { cpf: candidate.cpf } : {}),
      ...(candidate.patientName ? { name: candidate.patientName } : {})
    };
    const previous = { name: issue.contact.name, cpf: issue.contact.cpf };
    await issue.contact.update(updates);
    await ContactQuarkLink.upsert({
      contactId: issue.contactId,
      quarkPatientId: patientId,
      status: "CONFIRMED",
      matchMethod: "MANUAL_REVIEW",
      confidence: 100,
      confirmedByUserId: userId,
      confirmedAt: now,
      rejectedAt: null
    });
    await ContactIdentityAudit.create({
      contactId: issue.contactId,
      userId,
      action: "CONFIRM_PATIENT",
      source: "MANUAL",
      previousValueHash: valueHash(previous),
      newValueHash: valueHash(updates),
      metadata: safeJson({ patientId, fields: Object.keys(updates) })
    });
    getIO().emit("contact", { action: "update", contact: issue.contact });
  } else {
    if (action === "KEEP_SEPARATE") {
      const existingLink = await ContactQuarkLink.findOne({
        where: { contactId: issue.contactId }
      });
      if (existingLink) {
        await existingLink.update({
          status: "REJECTED",
          matchMethod: "MANUAL_KEEP_SEPARATE",
          confidence: 0,
          confirmedByUserId: userId,
          confirmedAt: null,
          rejectedAt: now
        });
      } else {
        await ContactQuarkLink.create({
          contactId: issue.contactId,
          quarkPatientId: "NONE",
          status: "REJECTED",
          matchMethod: "MANUAL_KEEP_SEPARATE",
          confidence: 0,
          confirmedByUserId: userId,
          confirmedAt: null,
          rejectedAt: now
        });
      }
    }
    await ContactIdentityAudit.create({
      contactId: issue.contactId,
      userId,
      action,
      source: "MANUAL",
      previousValueHash: null,
      newValueHash: null,
      metadata: safeJson({ issueId, type: issue.type })
    });
  }
  await issue.update({
    status: action === "IGNORE" ? "IGNORED" : "RESOLVED",
    resolution: action,
    resolvedByUserId: userId,
    resolvedAt: now
  });
  getIO().to("admin").emit("identityIssue", {
    action: "update",
    issueId: issue.id,
    status: issue.status
  });
  return issue.reload({ include: [{ model: Contact }] });
};

export default ResolveIdentityIssueService;
