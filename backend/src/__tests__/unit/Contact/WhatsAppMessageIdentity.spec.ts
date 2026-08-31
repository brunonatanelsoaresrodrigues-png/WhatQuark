import { resolveWhatsAppMessageIdentity } from "../../../helpers/WhatsAppMessageIdentity";

describe("resolveWhatsAppMessageIdentity", () => {
  it("uses recipientPn for an outbound message addressed by LID", () => {
    expect(
      resolveWhatsAppMessageIdentity(
        "276299574685761@lid",
        {
          recipientLid: "276299574685761@lid",
          recipientPn: "5585991234567@s.whatsapp.net"
        },
        undefined,
        true
      )
    ).toEqual({
      resolvedJid: "5585991234567@s.whatsapp.net",
      phoneJid: "5585991234567@s.whatsapp.net",
      lid: "276299574685761@lid"
    });
  });

  it("uses senderPn for an inbound LID message", () => {
    expect(
      resolveWhatsAppMessageIdentity(
        "214533650018337@lid",
        {
          senderPn: "558587295529@s.whatsapp.net",
          senderLid: "214533650018337@lid"
        },
        undefined,
        false
      )
    ).toEqual({
      resolvedJid: "558587295529@s.whatsapp.net",
      phoneJid: "558587295529@s.whatsapp.net",
      lid: "214533650018337@lid"
    });
  });

  it("accepts snake case and a bare phone number", () => {
    expect(
      resolveWhatsAppMessageIdentity(
        "214533650018337@lid",
        { recipient_pn: "558587295529" },
        undefined,
        true
      )
    ).toEqual({
      resolvedJid: "558587295529@s.whatsapp.net",
      phoneJid: "558587295529@s.whatsapp.net",
      lid: "214533650018337@lid"
    });
  });

  it("never invents a phone when WhatsApp only supplied a LID", () => {
    expect(
      resolveWhatsAppMessageIdentity(
        "214533650018337@lid",
        {},
        undefined,
        false
      )
    ).toEqual({
      resolvedJid: "214533650018337@lid",
      phoneJid: undefined,
      lid: "214533650018337@lid"
    });
  });
});
