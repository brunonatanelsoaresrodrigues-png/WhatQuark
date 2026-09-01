import {
  bestIncomingContactName,
  contactIdentityFallback,
  incomingContactName,
  isTechnicalContactName,
  storedContactName
} from "../../../helpers/ContactIdentity";

describe("ContactIdentity", () => {
  const number = "558587295529";
  const lid = "214533650018337@lid";

  it("recognizes the internal LID as a technical name", () => {
    expect(isTechnicalContactName("214533650018337", number, lid)).toBe(true);
    expect(isTechnicalContactName(lid, number, lid)).toBe(true);
  });

  it("uses the real phone when the LID and phone are different", () => {
    expect(contactIdentityFallback(number, lid)).toBe(number);
    expect(incomingContactName("214533650018337", number, lid)).toBe(number);
  });

  it("does not expose the LID when no phone mapping is available", () => {
    expect(contactIdentityFallback("214533650018337", lid)).toBe(
      "Contato WhatsApp"
    );
  });

  it("keeps a real stored or provider name", () => {
    expect(incomingContactName("Maria", number, lid)).toBe("Maria");
    expect(storedContactName("Maria", "Outro nome", number, lid)).toBe(
      "Maria"
    );
    expect(storedContactName(lid, "Maria", number, lid)).toBe("Maria");
  });

  it("skips a technical store name and uses the public push name", () => {
    expect(
      bestIncomingContactName(["214533650018337", "Maria"], number, lid)
    ).toBe("Maria");
  });
});
