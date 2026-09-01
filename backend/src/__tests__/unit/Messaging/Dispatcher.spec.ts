import { registerMessageAttribution } from "../../../services/MessageServices/MessageAttributionService";
import OutboundMessage from "../../../models/OutboundMessage";
import Whatsapp from "../../../models/Whatsapp";
import Ticket from "../../../models/Ticket";
import Contact from "../../../models/Contact";
import { assertExecution } from "../../../services/MessagingServices/policy";
import { getPreference } from "../../../services/MessagingServices/preferences";
import { readState } from "../../../services/MessagingServices/state";
import {
  consentErrorForSend,
  enqueueOutbound,
  outboundPriorityFor,
  processOutbound,
  stopDispatcher,
  usesGenericRecipientPacing,
  validateSend
} from "../../../services/MessagingServices/dispatcher";
jest.mock("../../../models/OutboundMessage", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    findOrCreate: jest.fn()
  }
}));
jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));
jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));
jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));
jest.mock("../../../services/MessagingServices/persistCloudOutbound", () =>
  jest.fn()
);
jest.mock("../../../services/MessagingServices/policy", () => ({
  ...jest.requireActual("../../../services/MessagingServices/policy"),
  assertExecution: jest.fn()
}));
jest.mock("../../../services/MessagingServices/preferences", () => ({
  ...jest.requireActual("../../../services/MessagingServices/preferences"),
  getPreference: jest.fn()
}));
jest.mock("../../../services/MessagingServices/state", () => ({
  ...jest.requireActual("../../../services/MessagingServices/state"),
  readState: jest.fn(),
  withLease: (_: string, fn: Function) => fn()
}));
jest.mock(
  "../../../services/MessageServices/MessageAttributionService",
  () => ({ registerMessageAttribution: jest.fn() })
);
const transport = { sendMessage: jest.fn(), sendMedia: jest.fn() };
let row: any;
beforeEach(() => {
  jest.resetAllMocks();
  process.env.WHATSAPP_PROVIDER = "cloud";
  process.env.MESSAGING_MAX_PER_HOUR = "100";
  process.env.QUARK_QUIET_HOURS_START = "00:00";
  process.env.QUARK_QUIET_HOURS_END = "00:00";
  process.env.QUARK_APPOINTMENT_NOTICES_REQUIRE_OPT_IN = "false";
  (getPreference as jest.Mock).mockResolvedValue({ consent: "GRANTED" });
  (Whatsapp.findByPk as jest.Mock).mockResolvedValue({ status: "CONNECTED" });
  (readState as jest.Mock).mockImplementation((key, fallback) =>
    Promise.resolve(
      key.startsWith("inbound-time")
        ? new Date(Date.now() - 1000).toISOString()
        : fallback
    )
  );
  (OutboundMessage.update as jest.Mock).mockResolvedValue([0]);
  (OutboundMessage.count as jest.Mock).mockResolvedValue(0);
  (OutboundMessage.findOne as jest.Mock).mockResolvedValue(null);
  row = {
    id: "outbound-test",
    whatsappId: 1,
    recipient: "5511999990000",
    kind: "text",
    status: "PENDING",
    payload: JSON.stringify({
      to: "5511999990000@c.us",
      body: "test",
      options: { policy: {} }
    }),
    update: jest.fn(async (values: any) => Object.assign(row, values)),
    reload: jest.fn()
  };
  (OutboundMessage.findAll as jest.Mock).mockImplementation(options =>
    Promise.resolve(
      options?.where?.recipient ? [] : row.status === "PENDING" ? [row] : []
    )
  );
  (OutboundMessage.findByPk as jest.Mock).mockResolvedValue(row);
  transport.sendMessage.mockResolvedValue({
    id: "provider-1",
    body: "test",
    fromMe: true
  });
});

const preference = (consent: "UNKNOWN" | "GRANTED" | "REVOKED") => ({
  consent,
  changedAt: null,
  source: null,
  actorUserId: null,
  relationship: null,
  version: "appointment-notices-v1"
});

it("allows only appointment-bound operational notices without manual opt-in", () => {
  expect(
    consentErrorForSend(
      preference("UNKNOWN"),
      { proactive: true, appointmentNotice: true, appointmentId: "42" },
      false
    )
  ).toBeNull();
  expect(
    consentErrorForSend(preference("UNKNOWN"), { proactive: true }, false)
  ).toBe("ERR_CONSENT_REQUIRED");
});

it("never bypasses an appointment notice opt-out", () => {
  expect(
    consentErrorForSend(
      preference("REVOKED"),
      { proactive: true, appointmentNotice: true, appointmentId: "42" },
      false
    )
  ).toBe("ERR_RECIPIENT_OPTED_OUT");
});

it("does not let generic recipient limits postpone appointment notices", () => {
  expect(
    usesGenericRecipientPacing({
      proactive: true,
      appointmentNotice: true,
      appointmentId: "42"
    })
  ).toBe(false);
  expect(usesGenericRecipientPacing({ proactive: true })).toBe(true);
});

it("prioritizes appointment notices below human replies and above bot traffic", () => {
  expect(outboundPriorityFor({ origin: "HUMAN" })).toBe(10);
  expect(
    outboundPriorityFor({
      proactive: true,
      appointmentNotice: true,
      appointmentId: "42"
    })
  ).toBe(6);
  expect(outboundPriorityFor({})).toBe(5);
  expect(outboundPriorityFor({ proactive: true })).toBe(1);
});

it("bypasses patient consent only for an authorized internal report", () => {
  const policy = { proactive: true, internalReport: true };
  expect(
    consentErrorForSend(preference("UNKNOWN"), policy, false, true)
  ).toBeNull();
  expect(consentErrorForSend(preference("UNKNOWN"), policy, false, false)).toBe(
    "ERR_CONSENT_REQUIRED"
  );
});

it("stores PROCESSING before calling transport and then persists success", async () => {
  transport.sendMessage.mockImplementation(async () => {
    expect(row.status).toBe("PROCESSING");
    return { id: "provider-1" };
  });
  await processOutbound(transport);
  expect(row.status).toBe("SENT");
  expect(row.messageId).toBe("provider-1");
});
it("does not resend an ambiguous transport failure", async () => {
  transport.sendMessage.mockRejectedValue(new Error("timeout"));
  await processOutbound(transport);
  expect(row.status).toBe("UNKNOWN");
  await processOutbound(transport);
  expect(transport.sendMessage).toHaveBeenCalledTimes(1);
});
it("does not resend after a post-send storage failure", async () => {
  row.update.mockImplementation(async (values: any) => {
    if (values.status === "SENT") throw new Error("DB failed");
    Object.assign(row, values);
  });
  await processOutbound(transport);
  expect(row.status).toBe("UNKNOWN");
  await processOutbound(transport);
  expect(transport.sendMessage).toHaveBeenCalledTimes(1);
});
it("shares the channel hourly cap across message origins", async () => {
  (OutboundMessage.count as jest.Mock).mockResolvedValue(100);
  await processOutbound(transport);
  expect(transport.sendMessage).not.toHaveBeenCalled();
  expect(row.status).toBe("PENDING");
});
it("expires delayed notices before considering quota", async () => {
  row.payload = JSON.stringify({
    options: {
      policy: { expiresAt: new Date(Date.now() - 1000).toISOString() }
    }
  });
  (OutboundMessage.count as jest.Mock).mockResolvedValue(100);
  await processOutbound(transport);
  expect(row.status).toBe("BLOCKED");
  expect(row.errorCode).toBe("ERR_MESSAGE_EXPIRED");
  expect(transport.sendMessage).not.toHaveBeenCalled();
});
it("checks opt-out again immediately before delivery", async () => {
  row.payload = JSON.stringify({ options: { policy: { proactive: true } } });
  (getPreference as jest.Mock).mockResolvedValue({ consent: "REVOKED" });
  await processOutbound(transport);
  expect(row.errorCode).toBe("ERR_RECIPIENT_OPTED_OUT");
  expect(transport.sendMessage).not.toHaveBeenCalled();
});
it("requires a template outside the service window", async () => {
  (readState as jest.Mock).mockResolvedValue(null);
  await expect(validateSend(1, row.recipient, {})).rejects.toThrow(
    "ERR_APPROVED_TEMPLATE_REQUIRED"
  );
});
it("rejects stale bot sends after human takeover", async () => {
  (Ticket.findByPk as jest.Mock).mockResolvedValue({
    id: 1,
    whatsappId: 1,
    userId: 9,
    status: "open"
  });
  await expect(
    validateSend(1, row.recipient, { ticketId: 1, bot: true })
  ).rejects.toThrow("ERR_BOT_PAUSED");
});
it("allows an unassigned appointment reply while the general bot is paused", async () => {
  (Ticket.findByPk as jest.Mock).mockResolvedValue({
    id: 1,
    whatsappId: 1,
    contactId: 2,
    userId: null,
    status: "pending"
  });
  (Contact.findByPk as jest.Mock).mockResolvedValue({
    id: 2,
    number: row.recipient
  });
  (readState as jest.Mock).mockImplementation((key, fallback) =>
    Promise.resolve(
      key.startsWith("inbound-time")
        ? new Date(Date.now() - 1000).toISOString()
        : key === "bot-pause:1"
        ? true
        : fallback
    )
  );

  await expect(
    validateSend(1, row.recipient, {
      ticketId: 1,
      bot: true,
      allowPausedBot: true
    })
  ).resolves.toBeUndefined();
});
it("returns the prior result for the same idempotency key", async () => {
  row.status = "SENT";
  row.result = JSON.stringify({ id: "original" });
  const result = await enqueueOutbound(transport, 1, row.recipient, "test", {
    policy: { idempotencyKey: "stable" }
  });
  expect(result.id).toBe("original");
  expect(transport.sendMessage).not.toHaveBeenCalled();
  expect(OutboundMessage.findOrCreate).not.toHaveBeenCalled();
});
it("never queues a group recipient", async () => {
  await expect(
    enqueueOutbound(transport, 1, "123456789@g.us", "test")
  ).rejects.toThrow("ERR_INVALID_RECIPIENT");
});

it.each(["whaileys", "wwebjs"])(
  "delivers through the existing %s transport without Meta consent",
  async provider => {
    process.env.WHATSAPP_PROVIDER = provider;
    (getPreference as jest.Mock).mockResolvedValue({ consent: "UNKNOWN" });
    (readState as jest.Mock).mockImplementation((_: string, fallback: any) =>
      Promise.resolve(fallback)
    );
    await processOutbound(transport);
    expect(transport.sendMessage).toHaveBeenCalledTimes(1);
    expect(row.status).toBe("SENT");
  }
);
it.each(["whaileys", "wwebjs"])(
  "keeps opt-out protection on the %s transport",
  async provider => {
    process.env.WHATSAPP_PROVIDER = provider;
    row.payload = JSON.stringify({ options: { policy: { proactive: true } } });
    (getPreference as jest.Mock).mockResolvedValue({ consent: "REVOKED" });
    await processOutbound(transport);
    expect(transport.sendMessage).not.toHaveBeenCalled();
    expect(row.errorCode).toBe("ERR_RECIPIENT_OPTED_OUT");
  }
);

it("retains the sender of queued unofficial messages after the HTTP request ends", async () => {
  process.env.WHATSAPP_PROVIDER = "whaileys";
  row.payload = JSON.stringify({
    to: row.recipient,
    body: "test",
    options: { policy: { origin: "HUMAN", sentByUserId: 7 } }
  });
  await processOutbound(transport);
  expect(registerMessageAttribution).toHaveBeenCalledWith("provider-1", {
    origin: "HUMAN",
    sentByUserId: 7
  });
});

it("drains an immediate send before shutdown without starting another", async () => {
  let finish: (value: any) => void = () => undefined;
  let started: () => void = () => undefined;
  const began = new Promise<void>(resolve => {
    started = resolve;
  });
  transport.sendMessage.mockImplementation(() => {
    started();
    return new Promise(resolve => {
      finish = resolve;
    });
  });
  const run = processOutbound(transport);
  await began;
  let stopped = false;
  const stop = stopDispatcher().then(() => {
    stopped = true;
  });
  await Promise.resolve();
  expect(stopped).toBe(false);
  finish({ id: "drained-send" });
  await Promise.all([run, stop]);
  expect(row.status).toBe("SENT");
  await processOutbound(transport);
  expect(transport.sendMessage).toHaveBeenCalledTimes(1);
});
