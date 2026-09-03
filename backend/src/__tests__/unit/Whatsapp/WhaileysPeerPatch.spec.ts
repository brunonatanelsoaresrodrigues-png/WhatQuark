import fs from "fs";
import vm from "vm";
const {
  patchSource
} = require("../../../../scripts/patch-whaileys-history.cjs");
const source = fs.readFileSync(
  require.resolve("whaileys/lib/Socket/messages-send"),
  "utf8"
);

it("patches the installed implementation idempotently and preserves valid JavaScript", () => {
  const patched = patchSource(source);
  expect(patchSource(patched)).toBe(patched);
  expect(() => new vm.Script(patched)).not.toThrow();
});

it("fails closed when the provider implementation does not match", () => {
  expect(() => patchSource("unrecognized provider implementation")).toThrow(
    "Unexpected whaileys peer implementation"
  );
});

it("routes peer/history requests to the saved primary phone identity, never a patient", async () => {
  const patched = patchSource(source);
  const start = patched.indexOf("const sendPeerDataOperationMessage =");
  const end = patched.indexOf("const createParticipantNodes =", start);
  const relayMessage = jest.fn().mockResolvedValue("request-id");
  const send = vm.runInNewContext(
    `${patched.slice(start, end)}; sendPeerDataOperationMessage`,
    {
      authState: {
        creds: {
          me: { id: "5511000000000:3@s.whatsapp.net", lid: "123456:3@lid" }
        }
      },
      WABinary_1: {
        jidNormalizedUser: (jid: string) => jid.replace(/:\d+@/, "@")
      },
      WAProto_1: {
        proto: {
          Message: {
            ProtocolMessage: {
              Type: { PEER_DATA_OPERATION_REQUEST_MESSAGE: 16 }
            }
          }
        }
      },
      relayMessage
    }
  );
  await send({ historySyncOnDemandRequest: { chatJid: "patient@lid" } });
  expect(relayMessage).toHaveBeenCalledWith(
    "5511000000000@s.whatsapp.net",
    expect.any(Object),
    expect.objectContaining({
      additionalAttributes: { category: "peer", push_priority: "high_force" }
    })
  );
});

it("omits tctoken only from peer requests, retaining it for normal patient messages", () => {
  const patched = patchSource(source);
  const expression = patched.match(/const contactTcTokenData = ([^\n]+)\n/)![1];
  const needsToken = new Function(
    "isGroup",
    "isRetryResend",
    "isStatus",
    "additionalAttributes",
    `return ${expression};`
  );
  expect(needsToken(false, false, false, { category: "peer" })).toBe(false);
  expect(needsToken(false, false, false, {})).toBe(true);
  expect(needsToken(false, false, false, undefined)).toBe(true);
  expect(needsToken(true, false, false, {})).toBe(false);
});

it("adds default appdata only to the peer envelope", () => {
  const patched = patchSource(source);
  const code = patched.match(
    /if \(additionalAttributes\?\.category === "peer"\) \{\n\s+binaryNodeContent.push\([^\n]+\n\s+\}/
  )![0];
  const peer: unknown[] = [];
  const patient: unknown[] = [];
  vm.runInNewContext(code, {
    additionalAttributes: { category: "peer" },
    binaryNodeContent: peer
  });
  vm.runInNewContext(code, {
    additionalAttributes: {},
    binaryNodeContent: patient
  });
  expect(peer).toEqual([{ tag: "meta", attrs: { appdata: "default" } }]);
  expect(patient).toEqual([]);
});
