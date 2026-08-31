import { Op } from "sequelize";
import Contact from "../../models/Contact";
import ContactIdentityAudit from "../../models/ContactIdentityAudit";
import ContactIdentityIssue from "../../models/ContactIdentityIssue";
import ContactQuarkLink from "../../models/ContactQuarkLink";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import {
  contactHasTechnicalName,
  contactHasUnresolvedLid,
  findConfirmedQuarkCandidate,
  findQuarkCandidates,
  issueFingerprint,
  maskedCpf,
  safeJson,
  valueHash
} from "./identityEvidence";

interface ReconcileResult {
  processed: number;
  issuesOpened: number;
  contactsUpdated: number;
  ambiguous: number;
  remoteLookups: number;
  remoteLookupErrors: number;
}

interface ReconcileContext {
  remainingRemoteLookups: number;
}

interface IssueInput {
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  discriminator?: string;
  evidence: Record<string, unknown>;
}

let activeRun: Promise<ReconcileResult> | null = null;

const upsertIssue = async (
  contactId: number,
  issue: IssueInput,
  now: Date
): Promise<ContactIdentityIssue> => {
  const fingerprint = issueFingerprint(
    contactId,
    issue.type,
    issue.discriminator
  );
  const [row] = await ContactIdentityIssue.findOrCreate({
    where: { fingerprint },
    defaults: {
      contactId,
      type: issue.type,
      status: "OPEN",
      severity: issue.severity,
      fingerprint,
      evidence: safeJson(issue.evidence),
      detectedAt: now,
      lastSeenAt: now
    }
  });
  await row.update({
    severity: issue.severity,
    evidence: safeJson(issue.evidence),
    lastSeenAt: now,
    ...(row.status === "RESOLVED"
      ? { status: "OPEN", resolution: null, resolvedAt: null }
      : {})
  });
  return row;
};

const reconcileContact = async (
  contact: Contact,
  result: ReconcileResult,
  context: ReconcileContext
): Promise<void> => {
  const now = new Date();
  const seen = new Set<string>();
  const register = async (issue: IssueInput) => {
    const row = await upsertIssue(contact.id, issue, now);
    seen.add(row.fingerprint);
    result.issuesOpened += row.status === "OPEN" ? 1 : 0;
  };

  if (contactHasUnresolvedLid(contact)) {
    await register({
      type: "UNRESOLVED_LID",
      severity: "WARNING",
      evidence: { phoneState: "AWAITING_WHATSAPP_MAPPING" }
    });
  }
  if (contactHasTechnicalName(contact)) {
    await register({
      type: "TECHNICAL_NAME",
      severity: "INFO",
      evidence: { currentName: "TECHNICAL" }
    });
  }

  const existingLink = await ContactQuarkLink.findOne({
    where: { contactId: contact.id }
  });
  const keepSeparate =
    existingLink?.status === "REJECTED" &&
    existingLink.matchMethod === "MANUAL_KEEP_SEPARATE";
  let candidates = [] as Awaited<ReturnType<typeof findQuarkCandidates>>;
  const hasConfirmedLink =
    existingLink?.status === "CONFIRMED" && Boolean(existingLink.quarkPatientId);
  if (!keepSeparate && hasConfirmedLink) {
    try {
      let confirmed = await findConfirmedQuarkCandidate(
        existingLink!.quarkPatientId,
        false
      );
      const canRefreshCpf =
        Boolean(confirmed) &&
        !contact.cpf &&
        !confirmed!.cpf &&
        context.remainingRemoteLookups > 0;
      if (canRefreshCpf) {
        context.remainingRemoteLookups -= 1;
        result.remoteLookups += 1;
        try {
          confirmed = await findConfirmedQuarkCandidate(
            existingLink!.quarkPatientId,
            true
          );
        } catch (error) {
          result.remoteLookupErrors += 1;
          logger.warn({
            info: "Confirmed Quark patient enrichment failed",
            contactId: contact.id,
            err: error
          });
        }
      }
      if (confirmed) candidates = [confirmed];
    } catch (error) {
      logger.warn({
        info: "Confirmed Quark patient lookup failed",
        contactId: contact.id,
        err: error
      });
    }
    if (!candidates.length && !contactHasUnresolvedLid(contact)) {
      candidates = await findQuarkCandidates(contact);
    }
  } else if (!contactHasUnresolvedLid(contact) && !keepSeparate) {
    candidates = await findQuarkCandidates(contact);
  }
  if (candidates.length > 1) {
    result.ambiguous += 1;
    await register({
      type: "AMBIGUOUS_QUARK_PATIENT",
      severity: "CRITICAL",
      discriminator: candidates.map(item => item.patientId).sort().join(","),
      evidence: {
        candidates: candidates.map(item => ({
          patientId: item.patientId,
          patientName: item.patientName,
          cpf: maskedCpf(item.cpf),
          appointmentId: item.appointmentId
        }))
      }
    });
    await ContactQuarkLink.upsert({
      contactId: contact.id,
      quarkPatientId: candidates.map(item => item.patientId).sort().join(",").slice(0, 64),
      status: "AMBIGUOUS",
      matchMethod: "PHONE_VARIANTS",
      confidence: 0,
      confirmedByUserId: null,
      confirmedAt: null,
      rejectedAt: null
    });
  } else if (candidates.length === 1) {
    const candidate = candidates[0];
    await ContactQuarkLink.upsert({
      contactId: contact.id,
      quarkPatientId: candidate.patientId,
      status: "CONFIRMED",
      matchMethod: hasConfirmedLink
        ? existingLink!.matchMethod
        : "UNIQUE_PHONE",
      confidence: 100,
      confirmedByUserId: hasConfirmedLink
        ? existingLink!.confirmedByUserId
        : null,
      confirmedAt: hasConfirmedLink
        ? existingLink!.confirmedAt || now
        : now,
      rejectedAt: null
    });

    const updates: { name?: string; cpf?: string } = {};
    if (contactHasTechnicalName(contact) && candidate.patientName)
      updates.name = candidate.patientName;
    if (!contact.cpf && candidate.cpf) updates.cpf = candidate.cpf;

    if (contact.cpf && candidate.cpf && contact.cpf !== candidate.cpf) {
      await register({
        type: "CPF_CONFLICT",
        severity: "CRITICAL",
        discriminator: candidate.patientId,
        evidence: {
          patientId: candidate.patientId,
          squadCpf: maskedCpf(contact.cpf),
          quarkCpf: maskedCpf(candidate.cpf)
        }
      });
    } else if (!contact.cpf && !candidate.cpf) {
      await register({
        type: "MISSING_CPF",
        severity: "INFO",
        discriminator: candidate.patientId,
        evidence: { patientId: candidate.patientId, source: "QUARK_EMPTY" }
      });
    }

    if (Object.keys(updates).length) {
      const previous = { name: contact.name, cpf: contact.cpf };
      await contact.update(updates);
      await ContactIdentityAudit.create({
        contactId: contact.id,
        userId: null,
        action: "AUTO_RECONCILED",
        source: "QUARK",
        previousValueHash: valueHash(previous),
        newValueHash: valueHash(updates),
        metadata: safeJson({ fields: Object.keys(updates), patientId: candidate.patientId })
      });
      result.contactsUpdated += 1;
      getIO().emit("contact", { action: "update", contact });
    }
  }

  const openIssues = await ContactIdentityIssue.findAll({
    where: { contactId: contact.id, status: "OPEN" }
  });
  for (const issue of openIssues) {
    if (!seen.has(issue.fingerprint)) {
      await issue.update({
        status: "RESOLVED",
        resolution: "AUTO_CLEARED",
        resolvedAt: now
      });
    }
  }
};

const run = async (contactId?: number): Promise<ReconcileResult> => {
  const result: ReconcileResult = {
    processed: 0,
    issuesOpened: 0,
    contactsUpdated: 0,
    ambiguous: 0,
    remoteLookups: 0,
    remoteLookupErrors: 0
  };
  const configuredLimit = Number(
    process.env.IDENTITY_QUARK_ENRICHMENT_LIMIT || "100"
  );
  const context: ReconcileContext = {
    remainingRemoteLookups: contactId
      ? 1
      : Number.isInteger(configuredLimit) && configuredLimit >= 0
      ? configuredLimit
      : 100
  };
  let lastId = 0;
  do {
    const contacts = await Contact.findAll({
      where: {
        isGroup: false,
        ...(contactId ? { id: contactId } : { id: { [Op.gt]: lastId } })
      },
      order: [["id", "ASC"]],
      limit: contactId ? 1 : 50
    });
    if (!contacts.length) break;
    for (const contact of contacts) {
      await reconcileContact(contact, result, context);
      result.processed += 1;
      lastId = contact.id;
    }
    if (contactId || contacts.length < 50) break;
  } while (true);
  logger.info({ info: "Identity reconciliation completed", ...result });
  getIO().to("admin").emit("identityHealth", result);
  return result;
};

const ReconcileContactIdentitiesService = async (
  contactId?: number
): Promise<ReconcileResult> => {
  if (contactId) return run(contactId);
  if (!activeRun) activeRun = run().finally(() => (activeRun = null));
  return activeRun;
};

export default ReconcileContactIdentitiesService;
