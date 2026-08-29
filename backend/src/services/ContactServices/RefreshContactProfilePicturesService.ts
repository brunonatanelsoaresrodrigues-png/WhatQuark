import { Op } from "sequelize";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import { whatsappProvider } from "../../providers/WhatsApp";
import { logger } from "../../utils/logger";
import { readState, withLease, writeState } from "../MessagingServices/state";

interface RefreshRequest {
  id: number;
  force?: boolean;
}

interface RefreshState {
  checkedAt?: string;
  sourceUrl?: string;
  found?: boolean;
}

export interface RefreshedContactPicture {
  id: number;
  profilePicUrl: string;
  refreshed: boolean;
}

const MISSING_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const BROKEN_COOLDOWN_MS = 15 * 60 * 1000;

const validPictureUrl = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) ? value : "";
  } catch {
    return "";
  }
};

const recentlyChecked = (
  state: RefreshState,
  contact: Contact,
  force: boolean
): boolean => {
  const checkedAt = Date.parse(state.checkedAt || "");
  if (!Number.isFinite(checkedAt)) return false;
  const cooldown = force ? BROKEN_COOLDOWN_MS : MISSING_COOLDOWN_MS;
  if (Date.now() - checkedAt >= cooldown) return false;
  return !force || state.sourceUrl === (contact.profilePicUrl || "");
};

const pictureFor = async (
  contact: Contact,
  request: RefreshRequest,
  userId: number
): Promise<RefreshedContactPicture> => {
  const current = contact.profilePicUrl || "";
  if ((!request.force && current) || !contact.number || contact.isInternal) {
    return { id: contact.id, profilePicUrl: current, refreshed: false };
  }

  const stateId = `contact-profile-picture:${contact.id}`;
  const fallback: RefreshState = {};

  try {
    return await withLease(stateId, async () => {
      const state = await readState<RefreshState>(stateId, fallback);
      if (recentlyChecked(state, contact, Boolean(request.force))) {
        return { id: contact.id, profilePicUrl: current, refreshed: false };
      }

      const ticket = await Ticket.findOne({
        where: {
          contactId: contact.id,
          whatsappId: { [Op.gt]: 0 }
        },
        attributes: ["whatsappId"],
        order: [["updatedAt", "DESC"]]
      });
      const whatsappId =
        ticket?.whatsappId || (await GetDefaultWhatsApp(userId)).id;

      let profilePicUrl = "";
      try {
        profilePicUrl = validPictureUrl(
          await whatsappProvider.getProfilePicUrl(whatsappId, contact.number)
        );
      } catch (error) {
        logger.debug({
          info: "Could not refresh contact profile picture",
          contactId: contact.id,
          error
        });
      }

      if (profilePicUrl && profilePicUrl !== current) {
        await contact.update({ profilePicUrl });
        getIO().emit("contact", { action: "update", contact });
      }

      await writeState(stateId, {
        checkedAt: new Date().toISOString(),
        sourceUrl: profilePicUrl || current,
        found: Boolean(profilePicUrl)
      });

      return {
        id: contact.id,
        profilePicUrl: profilePicUrl || current,
        refreshed: Boolean(profilePicUrl && profilePicUrl !== current)
      };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ERR_OPERATION_BUSY") {
      return { id: contact.id, profilePicUrl: current, refreshed: false };
    }
    throw error;
  }
};

const RefreshContactProfilePicturesService = async ({
  contacts,
  userId
}: {
  contacts: RefreshRequest[];
  userId: number;
}): Promise<RefreshedContactPicture[]> => {
  const requested = new Map<number, RefreshRequest>();
  contacts.forEach(request => {
    const previous = requested.get(request.id);
    requested.set(request.id, {
      id: request.id,
      force: Boolean(request.force || previous?.force)
    });
  });

  const rows = await Contact.findAll({
    where: { id: { [Op.in]: Array.from(requested.keys()) } },
    attributes: ["id", "number", "profilePicUrl", "isInternal"]
  });
  const byId = new Map(rows.map(contact => [contact.id, contact]));
  const result: RefreshedContactPicture[] = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const request of requested.values()) {
    const contact = byId.get(request.id);
    if (contact) {
      // Requests are intentionally sequential to avoid bursts against the
      // provider used by the connected WhatsApp session.
      // eslint-disable-next-line no-await-in-loop
      result.push(await pictureFor(contact, request, userId));
    }
  }

  return result;
};

export default RefreshContactProfilePicturesService;
