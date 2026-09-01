import Whatsapp from "../../models/Whatsapp";
import {
  ProviderMessage,
  ProviderMediaInput,
  ProviderContact,
  HistorySyncCursor,
  HistorySyncProgress,
  HistorySyncResult,
  SendMessageOptions,
  SendMediaOptions
} from "./types";
import { WhatsappWebJsProvider } from "./Implementations/wwebjs";
import { CloudWhatsAppProvider } from "./Implementations/cloud";
import { WhaileysProvider } from "./Implementations/whaileys";
import {
  enqueueOutbound,
  startDispatcher,
  stopDispatcher
} from "../../services/MessagingServices/dispatcher";

export interface WhatsappProvider {
  init(whatsapp: Whatsapp): Promise<void>;
  removeSession(whatsappId: number): Promise<void>;
  shutdown(): Promise<void>;
  logout(sessionId: number): Promise<void>;
  sendMessage(
    sessionId: number,
    to: string,
    body: string,
    options?: SendMessageOptions
  ): Promise<ProviderMessage>;
  sendMedia(
    sessionId: number,
    to: string,
    media: ProviderMediaInput,
    options?: SendMediaOptions
  ): Promise<ProviderMessage>;
  deleteMessage(
    sessionId: number,
    chatId: string,
    messageId: string,
    fromMe: boolean
  ): Promise<void>;
  checkNumber(sessionId: number, number: string): Promise<string>;
  getProfilePicUrl(sessionId: number, number: string): Promise<string>;
  getContacts(sessionId: number): Promise<ProviderContact[]>;
  sendSeen(sessionId: number, chatId: string): Promise<void>;
  fetchChatMessages(
    sessionId: number,
    chatId: string,
    limit: number
  ): Promise<ProviderMessage[]>;
  syncHistory(
    sessionId: number,
    cursors: HistorySyncCursor[],
    onProgress?: (progress: HistorySyncProgress) => void
  ): Promise<HistorySyncResult>;
}

const provider = process.env.WHATSAPP_PROVIDER || "wwebjs";

const providersMap: Record<string, WhatsappProvider> = {
  cloud: CloudWhatsAppProvider,
  wwebjs: WhatsappWebJsProvider,
  whaileys: WhaileysProvider
};

const rawProvider = providersMap[provider];
if (!rawProvider) throw new Error("Unsupported WHATSAPP_PROVIDER");
const whatsappProvider: WhatsappProvider = {
  ...rawProvider,
  sendMessage: (id, to, body, options) =>
    enqueueOutbound(rawProvider, id, to, body, options),
  sendMedia: (id, to, media, options) =>
    enqueueOutbound(rawProvider, id, to, media, options)
};
export const StartOutboundDispatcher = () => startDispatcher(rawProvider);
export const StopOutboundDispatcher = stopDispatcher;

export { whatsappProvider };
