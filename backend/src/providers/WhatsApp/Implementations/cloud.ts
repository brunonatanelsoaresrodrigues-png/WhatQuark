import axios from "axios";
import fs from "fs";
import AppError from "../../../errors/AppError";
import { WhatsappProvider } from "../whatsappProvider";
import {
  ProviderMessage,
  ProviderMediaInput,
  SendMessageOptions,
  SendMediaOptions
} from "../types";

export const cloudConfig = () => {
  const channelId = Number(process.env.CLOUD_WHATSAPP_ID);
  const phoneId = process.env.CLOUD_PHONE_NUMBER_ID || "";
  const version = process.env.CLOUD_API_VERSION || "";
  const token = process.env.CLOUD_ACCESS_TOKEN || "";
  if (
    !Number.isInteger(channelId) ||
    channelId <= 0 ||
    !/^\d+$/.test(phoneId) ||
    !/^v\d+\.\d+$/.test(version) ||
    !token
  )
    throw new AppError("ERR_CLOUD_CONFIGURATION_REQUIRED", 503);
  return { channelId, phoneId, version, token };
};
export const cloudRequest = async (
  method: "get" | "post",
  path: string,
  data?: any,
  headers = {}
): Promise<any> => {
  const config = cloudConfig();
  if (!/^[\w/-]+$/.test(path))
    throw new AppError("ERR_INVALID_CLOUD_PATH", 400);
  try {
    // Node 22 supplies multipart support; an inactive optional provider must
    // not require packages absent from the current unofficial runtime.
    if (typeof FormData !== "undefined" && data instanceof FormData) {
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 30000);
      try {
        const response = await fetch(
          `https://graph.facebook.com/${config.version}/${path}`,
          {
            method: method.toUpperCase(),
            body: data,
            headers: { Authorization: `Bearer ${config.token}`, ...headers },
            redirect: "error",
            signal: abort.signal
          }
        );
        if (!response.ok) throw new Error("Cloud upload failed");
        return await response.json();
      } finally {
        clearTimeout(timeout);
      }
    }
    const response = await axios({
      method,
      url: `https://graph.facebook.com/${config.version}/${path}`,
      data,
      headers: { Authorization: `Bearer ${config.token}`, ...headers },
      timeout: 30000,
      maxRedirects: 0,
      maxContentLength: 21 * 1024 * 1024,
      maxBodyLength: 21 * 1024 * 1024
    });
    return response.data;
  } catch (error) {
    // Never expose Axios request headers, access tokens or patient content in logs.
    throw new AppError("ERR_CLOUD_REQUEST_FAILED", 502);
  }
};
const assertChannel = (id: number) => {
  const config = cloudConfig();
  if (id !== config.channelId)
    throw new AppError("ERR_CLOUD_CHANNEL_MISMATCH", 409);
  return config;
};
const unsupported = async (): Promise<any> => {
  throw new AppError("ERR_CLOUD_FEATURE_UNSUPPORTED", 409);
};
const resultFrom = (
  id: string,
  to: string,
  body: string,
  type: ProviderMessage["type"] = "chat"
): ProviderMessage => ({
  id,
  body,
  to,
  from: cloudConfig().phoneId,
  fromMe: true,
  type,
  hasMedia: type !== "chat",
  timestamp: Math.floor(Date.now() / 1000),
  ack: 1
});
const submit = async (
  channelId: number,
  to: string,
  body: string,
  content: object,
  options?: SendMessageOptions,
  type?: ProviderMessage["type"]
) => {
  const config = assertChannel(channelId);
  const data = await cloudRequest("post", `${config.phoneId}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to.split("@")[0],
    ...content,
    ...(options?.quotedMessageId
      ? { context: { message_id: options.quotedMessageId } }
      : {}),
    biz_opaque_callback_data: options?.policy?.outboundId
  });
  if (typeof data?.messages?.[0]?.id !== "string")
    throw new AppError("ERR_SEND_OUTCOME_UNKNOWN", 502);
  return resultFrom(data.messages[0].id, to, body, type);
};
export const CloudWhatsAppProvider: WhatsappProvider = {
  async syncHistory() {
    throw new AppError("ERR_HISTORY_SYNC_UNSUPPORTED", 409);
  },
  async init(whatsapp) {
    const config = assertChannel(whatsapp.id);
    await cloudRequest("get", config.phoneId);
    await whatsapp.update({ status: "CONNECTED", qrcode: "", retries: 0 });
  },
  removeSession: unsupported,
  logout: unsupported,
  async shutdown() {},
  async sendMessage(id, to, body, options) {
    const template = options?.policy?.template;
    return submit(
      id,
      to,
      body,
      template
        ? {
            type: "template",
            template: {
              name: template.name,
              language: { code: template.language },
              components: [
                {
                  type: "body",
                  parameters: template.parameters.map(text => ({
                    type: "text",
                    text
                  }))
                }
              ]
            }
          }
        : { type: "text", text: { body, preview_url: false } },
      options
    );
  },
  async sendMedia(
    id: number,
    to: string,
    media: ProviderMediaInput,
    options?: SendMediaOptions
  ) {
    const config = assertChannel(id);
    if (options?.sendAsSticker)
      throw new AppError("ERR_STICKER_PROVIDER_UNSUPPORTED", 409);
    if (options?.policy?.template)
      throw new AppError("ERR_MEDIA_TEMPLATE_UNSUPPORTED", 409);
    const content =
      media.data ||
      (media.path ? await fs.promises.readFile(media.path) : null);
    if (!content || content.length > 20 * 1024 * 1024)
      throw new AppError("ERR_INVALID_MEDIA", 400);
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", media.mimetype);
    form.append(
      "file",
      new Blob([content], { type: media.mimetype }),
      media.filename
    );
    const upload = await cloudRequest("post", `${config.phoneId}/media`, form);
    if (!/^\d+$/.test(upload?.id || ""))
      throw new AppError("ERR_CLOUD_MEDIA_UPLOAD_FAILED", 502);
    const type = options?.sendMediaAsDocument
      ? "document"
      : media.mimetype.startsWith("image/")
      ? "image"
      : media.mimetype.startsWith("audio/")
      ? "audio"
      : media.mimetype.startsWith("video/")
      ? "video"
      : "document";
    return submit(
      id,
      to,
      options?.caption || media.filename,
      {
        type,
        [type]: {
          id: upload.id,
          ...(type !== "audio" && options?.caption
            ? { caption: options.caption }
            : {}),
          ...(type === "document" ? { filename: media.filename } : {})
        }
      },
      options,
      type
    );
  },
  deleteMessage: unsupported,
  editMessage: unsupported,
  async checkNumber(id, number) {
    assertChannel(id);
    if (!/^\d{8,15}$/.test(number))
      throw new AppError("ERR_INVALID_RECIPIENT", 400);
    return number;
  },
  async getProfilePicUrl() {
    return "";
  },
  getContacts: unsupported,
  async sendSeen() {}, // Cloud read receipts require message IDs, not chat IDs.
  fetchChatMessages: unsupported
};
