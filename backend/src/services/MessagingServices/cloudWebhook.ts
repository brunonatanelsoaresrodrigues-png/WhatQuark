import { validSignature } from "./cloudSignature";
import { Router, raw } from "express";
import { Op } from "sequelize";
import axios from "axios";
import AutomationState from "../../models/AutomationState";
import Message from "../../models/Message";
import OutboundMessage from "../../models/OutboundMessage";
import {
  cloudConfig,
  cloudRequest
} from "../../providers/WhatsApp/Implementations/cloud";
import { digest, withLease, readState, writeState } from "./state";
import {
  handleMessage,
  handleMessageAck,
  MediaPayload
} from "../../handlers/handleWhatsappEvents";
import { recordInbound } from "./preferences";
import { HandleInboundAutomation } from "./HandleInboundAutomation";
import { logger } from "../../utils/logger";
import persistCloudOutbound from "./persistCloudOutbound";

const router = Router();
router.get("/webhooks/whatsapp", (req, res) => {
  const token = process.env.CLOUD_VERIFY_TOKEN;
  if (
    process.env.WHATSAPP_PROVIDER !== "cloud" ||
    !token ||
    req.query["hub.mode"] !== "subscribe" ||
    req.query["hub.verify_token"] !== token
  )
    return res.sendStatus(403);
  return res.status(200).send(String(req.query["hub.challenge"] || ""));
});
router.post(
  "/webhooks/whatsapp",
  raw({ type: "application/json", limit: "2mb" }),
  async (req, res) => {
    if (process.env.WHATSAPP_PROVIDER !== "cloud") return res.sendStatus(404);
    if (
      !Buffer.isBuffer(req.body) ||
      !validSignature(
        req.body,
        req.get("x-hub-signature-256") || "",
        process.env.CLOUD_APP_SECRET || ""
      )
    )
      return res.sendStatus(403);
    let body: any;
    try {
      body = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.sendStatus(400);
    }
    if (
      body?.object !== "whatsapp_business_account" ||
      !Array.isArray(body.entry)
    )
      return res.sendStatus(400);
    const config = cloudConfig();
    for (const entry of body.entry)
      for (const change of entry.changes || []) {
        const value = change.value;
        if (
          change.field !== "messages" ||
          value?.metadata?.phone_number_id !== config.phoneId
        )
          continue;
        const events = [
          ...(value.messages || []).map((message: any) => ({
            kind: "message",
            message,
            name: value.contacts?.find((c: any) => c.wa_id === message.from)
              ?.profile?.name
          })),
          ...(value.statuses || []).map((status: any) => ({
            kind: "receipt",
            receipt: status
          }))
        ];
        for (const event of events) {
          const identifier =
            event.message?.id ||
            `${event.receipt?.id}:${event.receipt?.status}:${event.receipt?.timestamp}`;
          if (!identifier || identifier.length > 512) continue;
          const id = `cloud-event:${digest(
            `${config.channelId}:${identifier}`
          )}`;
          await AutomationState.findOrCreate({
            where: { id },
            defaults: {
              id,
              data: JSON.stringify({
                status: "PENDING",
                attempts: 0,
                channelId: config.channelId,
                ...event
              })
            }
          });
        }
      }
    // Acknowledge only after durable storage. Provider retries cannot duplicate the event.
    return res.sendStatus(200);
  }
);
export default router;

const receiveMedia = async (
  message: any
): Promise<MediaPayload | undefined> => {
  const media = message[message.type];
  if (
    !["audio", "image", "video", "document", "sticker"].includes(
      message.type
    ) ||
    !/^\d+$/.test(media?.id || "")
  )
    return undefined;
  const info = await cloudRequest("get", media.id);
  const url = new URL(info.url);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !(
      url.hostname === "lookaside.fbsbx.com" ||
      url.hostname.endsWith(".fbcdn.net")
    ) ||
    Number(info.file_size) > 20 * 1024 * 1024
  )
    throw new Error("ERR_CLOUD_MEDIA_REJECTED");
  let data: Buffer;
  try {
    const response = await axios.get(url.toString(), {
      headers: { Authorization: `Bearer ${cloudConfig().token}` },
      responseType: "arraybuffer",
      maxContentLength: 20 * 1024 * 1024,
      maxRedirects: 0,
      timeout: 30000
    });
    data = Buffer.from(response.data);
  } catch {
    throw new Error("ERR_CLOUD_MEDIA_DOWNLOAD_FAILED");
  }
  return {
    filename:
      media.filename ||
      `media.${
        String(info.mime_type || "application/octet-stream").split("/")[1]
      }`,
    mimetype: info.mime_type || "application/octet-stream",
    data: data.toString("base64")
  };
};
const processEvent = async (event: any) => {
  if (event.kind === "receipt") {
    const receipt = event.receipt;
    const ack =
      receipt.status === "read" ? 3 : receipt.status === "delivered" ? 2 : 1;
    let row = receipt.biz_opaque_callback_data
      ? await OutboundMessage.findByPk(receipt.biz_opaque_callback_data)
      : null;
    if (!row)
      row = await OutboundMessage.findOne({ where: { messageId: receipt.id } });
    if (
      row &&
      row.whatsappId === event.channelId &&
      row.recipient === receipt.recipient_id
    ) {
      if (receipt.status === "failed")
        await row.update({
          status: "FAILED",
          errorCode: "ERR_PROVIDER_DELIVERY_FAILED",
          messageId: receipt.id
        });
      else if (
        ["sent", "delivered", "read"].includes(receipt.status) &&
        row.status === "UNKNOWN"
      ) {
        const payload = JSON.parse(row.payload);
        const result = {
          id: receipt.id,
          body: payload.body || payload.options.caption || "",
          fromMe: true,
          type: row.kind === "text" ? "chat" : "document",
          hasMedia: row.kind === "media",
          to: payload.to,
          from: cloudConfig().phoneId,
          timestamp: Number(receipt.timestamp),
          ack
        };
        await persistCloudOutbound(result as any, payload);
        await row.update({
          status: "SENT",
          messageId: receipt.id,
          result: JSON.stringify(result),
          errorCode: null
        });
      }
    }
    if (receipt.status !== "failed") {
      if (!(await Message.findByPk(receipt.id)))
        throw new Error("ERR_RECEIPT_WAITING_FOR_MESSAGE");
      await handleMessageAck(receipt.id, ack);
    }
    return;
  }
  const message = event.message;
  if (!/^\d{8,15}$/.test(message.from || "") || typeof message.id !== "string")
    throw new Error("ERR_CLOUD_INVALID_MESSAGE");
  const body =
    message.text?.body ||
    message.button?.payload ||
    message.button?.text ||
    message.interactive?.button_reply?.id ||
    message.interactive?.list_reply?.id ||
    message[message.type]?.caption ||
    `[Mensagem ${message.type}: consultar anexo ou solicitar detalhes]`;
  const existing = await Message.findByPk(message.id);
  if (existing) {
    await recordInbound(
      message.from,
      event.channelId,
      Number(message.timestamp)
    );
    await HandleInboundAutomation({
      ticketId: existing.ticketId,
      whatsappId: event.channelId,
      phone: message.from,
      body,
      messageId: message.id
    });
    return;
  }
  const media = await receiveMedia(message);
  await handleMessage(
    {
      id: message.id,
      body,
      fromMe: false,
      hasMedia: !!media,
      type: media
        ? message.type === "sticker"
          ? "image"
          : message.type
        : "chat",
      from: message.from,
      to: cloudConfig().phoneId,
      timestamp: Number(message.timestamp),
      quotedMsgId: message.context?.id
    },
    { name: event.name || message.from, number: message.from, isGroup: false },
    { whatsappId: event.channelId, unreadMessages: 1 },
    media,
    true
  );
};
let timer: NodeJS.Timeout | undefined;
let active: Promise<void> | undefined;
export const processCloudEvents = async () => {
  const rows = await AutomationState.findAll({
    where: {
      id: { [Op.like]: "cloud-event:%" },
      [Op.or]: [
        { data: { [Op.like]: '%"status":"PENDING"%' } },
        { data: { [Op.like]: '%"status":"RETRY"%' } }
      ]
    },
    order: [["updatedAt", "ASC"]],
    limit: 30
  });
  for (const row of rows) {
    try {
      await withLease(row.id, async () => {
        const event = await readState<any>(row.id, {});
        if (
          !["PENDING", "RETRY"].includes(event.status) ||
          (event.nextAttemptAt && event.nextAttemptAt > Date.now())
        )
          return;
        try {
          await processEvent(event);
          await writeState(row.id, {
            status: "DONE",
            completedAt: new Date().toISOString()
          });
        } catch {
          const attempts = (event.attempts || 0) + 1;
          await writeState(row.id, {
            ...event,
            status: attempts >= 5 ? "REVIEW" : "RETRY",
            attempts,
            nextAttemptAt: Date.now() + 60000
          });
          logger.warn({
            info: "Cloud webhook requires retry or review",
            eventId: row.id
          });
        }
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "ERR_OPERATION_BUSY")
        throw error;
    }
  }
};
export const StartCloudWebhookWorker = () => {
  if (process.env.WHATSAPP_PROVIDER !== "cloud" || timer) return;
  timer = setInterval(() => {
    if (!active)
      active = processCloudEvents()
        .catch(() => logger.error("Cloud webhook worker failed"))
        .finally(() => {
          active = undefined;
        });
  }, 1000);
  timer.unref();
};
export const StopCloudWebhookWorker = async () => {
  if (timer) clearInterval(timer);
  timer = undefined;
  if (active) await active;
};
