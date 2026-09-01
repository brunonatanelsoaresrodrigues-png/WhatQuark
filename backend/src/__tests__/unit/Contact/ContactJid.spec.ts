import contactJid, {
  isUnresolvedLidContact
} from "../../../helpers/ContactJid";

describe("ContactJid", () => {
  it("uses the phone JID when a real phone is known", () => {
    expect(
      contactJid({ number: "+55 (85) 99999-0000", lid: "123@lid" })
    ).toBe("5585999990000@c.us");
  });

  it("uses the LID while the phone identity remains unresolved", () => {
    const contact = {
      number: "214533650018337",
      lid: "214533650018337@lid"
    };
    expect(isUnresolvedLidContact(contact)).toBe(true);
    expect(contactJid(contact)).toBe(contact.lid);
  });

  it("keeps group addressing separate", () => {
    expect(contactJid({ number: "12345", isGroup: true }, true)).toBe(
      "12345@g.us"
    );
  });
});
