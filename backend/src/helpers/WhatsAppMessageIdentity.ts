type IdentityFields = Record<string, unknown> | null | undefined;

export interface WhatsAppMessageIdentity {
  resolvedJid: string;
  phoneJid?: string;
  lid?: string;
}

const stringField = (
  source: IdentityFields,
  camelCase: string,
  snakeCase: string
): string | undefined => {
  const value = source?.[camelCase] || source?.[snakeCase];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const firstMatching = (
  values: Array<string | undefined>,
  predicate: (value: string) => boolean
): string | undefined => values.find((value): value is string => !!value && predicate(value));

const isLid = (value: string): boolean => /@lid$/i.test(value);

const normalizePhoneJid = (value?: string): string | undefined => {
  if (!value || isLid(value) || /@g\.us$/i.test(value)) return undefined;
  if (/@s\.whatsapp\.net$/i.test(value)) return value;
  const digits = value.replace(/\D/g, "");
  return /^\d{8,15}$/.test(digits)
    ? `${digits}@s.whatsapp.net`
    : undefined;
};

/**
 * Whaileys uses recipientPn/recipientLid for outbound 1:1 messages and
 * senderPn/senderLid for inbound ones. Keeping both identities lets the
 * contact service merge a temporary LID contact into the real phone contact.
 */
export const resolveWhatsAppMessageIdentity = (
  jid: string,
  key: IdentityFields,
  context: IdentityFields,
  fromMe: boolean
): WhatsAppMessageIdentity => {
  const senderPn = stringField(key, "senderPn", "sender_pn") ||
    stringField(context, "senderPn", "sender_pn");
  const participantPn = stringField(key, "participantPn", "participant_pn") ||
    stringField(context, "participantPn", "participant_pn");
  const recipientPn = stringField(key, "recipientPn", "recipient_pn") ||
    stringField(context, "recipientPn", "recipient_pn");
  const peerRecipientPn =
    stringField(key, "peerRecipientPn", "peer_recipient_pn") ||
    stringField(context, "peerRecipientPn", "peer_recipient_pn");

  const phoneCandidates = fromMe
    ? [recipientPn, peerRecipientPn, participantPn, senderPn]
    : [senderPn, participantPn, recipientPn, peerRecipientPn];
  const phoneJid = phoneCandidates
    .map(normalizePhoneJid)
    .find((value): value is string => !!value);

  const senderLid = stringField(key, "senderLid", "sender_lid") ||
    stringField(context, "senderLid", "sender_lid");
  const participantLid =
    stringField(key, "participantLid", "participant_lid") ||
    stringField(context, "participantLid", "participant_lid");
  const recipientLid = stringField(key, "recipientLid", "recipient_lid") ||
    stringField(context, "recipientLid", "recipient_lid");

  const lidCandidates = fromMe
    ? [jid, recipientLid, participantLid, senderLid, ...phoneCandidates]
    : [jid, senderLid, participantLid, recipientLid, ...phoneCandidates];
  const lid = firstMatching(lidCandidates, isLid);

  const resolvedJid =
    phoneJid && (isLid(jid) || !/@(?:s\.whatsapp\.net|g\.us)$/i.test(jid))
      ? phoneJid
      : jid;

  return { resolvedJid, phoneJid, lid };
};

