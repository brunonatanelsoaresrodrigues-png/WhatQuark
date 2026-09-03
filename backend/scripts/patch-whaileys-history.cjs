const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Backport only the peer/history envelope fixes to the installed 6.5.1 runtime.
// Patient messages retain their privacy tokens and normal encryption path.
// Reference: WhiskeySockets/Baileys src/Socket/messages-send.ts,
// sendPeerDataOperationMessage and the peer tctoken exclusion (SMAX_INVALID/479).
const patches = [
  [
    "const meLid = (0, WABinary_1.jidNormalizedUser)(authState.creds.me.lid);\n        const msgId = await relayMessage(meLid, protocolMessage, {",
    "const meJid = (0, WABinary_1.jidNormalizedUser)(authState.creds.me.id);\n        const msgId = await relayMessage(meJid, protocolMessage, {"
  ],
  [
    "const contactTcTokenData = !isGroup && !isRetryResend && !isStatus\n",
    "const contactTcTokenData = !isGroup && !isRetryResend && !isStatus && additionalAttributes?.category !== \"peer\"\n"
  ],
  [
    "            const stanza = {\n                tag: \"message\",",
    "            if (additionalAttributes?.category === \"peer\") {\n                binaryNodeContent.push({ tag: \"meta\", attrs: { appdata: \"default\" } });\n            }\n            const stanza = {\n                tag: \"message\","
  ]
];

const patchSource = source => {
  let output = source.replace(/\r\n/g, "\n");
  for (const [before, after] of patches) {
    if (output.includes(after)) continue;
    if (output.split(before).length !== 2)
      throw new Error("Unexpected whaileys peer implementation; review before applying history patch");
    output = output.replace(before, after);
  }
  new vm.Script(output, { filename: "whaileys-history-patched.js" });
  return output;
};

if (require.main === module) {
  const packagePath = require.resolve("whaileys/package.json");
  if (require(packagePath).version !== "6.5.1")
    throw new Error("Review history patch for this whaileys version before building");
  const target = path.join(path.dirname(packagePath), "lib", "Socket", "messages-send.js");
  const source = fs.readFileSync(target, "utf8");
  const patched = patchSource(source);
  if (patched !== source) fs.writeFileSync(target, patched);
  console.log("Verified whaileys 6.5.1 peer/history compatibility patch");
}

module.exports = { patchSource };
