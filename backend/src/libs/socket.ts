import { Server as SocketIO, Socket } from "socket.io";
import { Server } from "http";
import { decode } from "jsonwebtoken";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";
import { AuthenticateUser } from "../services/AuthServices/AuthenticateUser";
import ShowUserService from "../services/UserServices/ShowUserService";
import AssertTicketAccess from "../services/TicketServices/AssertTicketAccess";
import {
  AccessibleTicket,
  canAccessTicket,
  TicketViewer
} from "../helpers/TicketAccessPolicy";

let io: SocketIO;
interface Subscription {
  token: string;
  userId: number;
  tickets: Set<string>;
  statuses: Set<string>;
  notifications: boolean;
}
const subscriptions = new Map<Socket, Subscription>();

export const disconnectUserSockets = (userId: number | string): void => {
  for (const [socket, subscription] of subscriptions) {
    if (subscription.userId === Number(userId)) socket.disconnect(true);
  }
};

// Recheck database permissions at delivery time: a previously joined room is
// not an authorization grant after a transfer or permission change.
export const emitTicketEvent = async (
  ticket: AccessibleTicket,
  event: "ticket" | "appMessage",
  payload: unknown
): Promise<void> => {
  const viewers = new Map<string, Promise<TicketViewer>>();
  for (const [socket, subscription] of subscriptions) {
    const inChat = subscription.tickets.has(String(ticket.id));
    if (
      !inChat &&
      !subscription.notifications &&
      !subscription.statuses.has(ticket.status)
    )
      continue;
    try {
      if (!viewers.has(subscription.token)) {
        viewers.set(
          subscription.token,
          AuthenticateUser(subscription.token).then(user =>
            ShowUserService(user.id)
          )
        );
      }
      const user = await viewers.get(subscription.token)!;
      if (canAccessTicket(user, ticket)) {
        socket.emit(event, payload);
      } else if (event === "ticket") {
        socket.emit("ticket", { action: "delete", ticketId: ticket.id });
        subscription.tickets.delete(String(ticket.id));
      }
    } catch {
      socket.disconnect(true);
    }
  }
};

export const initIO = (httpServer: Server): SocketIO => {
  io = new SocketIO(httpServer, { cors: { origin: process.env.FRONTEND_URL } });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== "string") throw new Error("Missing token");
      const user = await AuthenticateUser(token);
      subscriptions.set(socket, {
        token,
        userId: user.id,
        tickets: new Set(),
        statuses: new Set(),
        notifications: false
      });
      next();
    } catch {
      next(new Error("ERR_SESSION_EXPIRED"));
    }
  });
  io.on("connection", socket => {
    const subscription = subscriptions.get(socket)!;
    const claims = decode(subscription.token) as { exp: number };
    const expiry = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, claims.exp * 1000 - Date.now())
    );
    expiry.unref();
    socket.join(`user:${subscription.userId}`);
    AuthenticateUser(subscription.token)
      .then(user => {
        if (socket.connected && user.profile === "admin") socket.join("admin");
      })
      .catch(() => socket.disconnect(true));

    socket.on("joinChatBox", async (ticketId: unknown) => {
      try {
        if (!/^[1-9]\d*$/.test(String(ticketId)))
          throw new Error("Invalid ticket");
        await AuthenticateUser(subscription.token);
        await AssertTicketAccess(String(ticketId), subscription.userId);
        if (socket.connected) subscription.tickets.add(String(ticketId));
      } catch {
        socket.emit("ticketAccessDenied", { ticketId });
      }
    });
    socket.on("joinNotification", () => {
      subscription.notifications = true;
    });
    socket.on("joinTickets", (status: string) => {
      if (["open", "pending", "closed"].includes(status)) {
        subscription.statuses.add(status);
        // These rooms carry only removal events, never conversation content.
        socket.join(status);
      }
    });
    socket.on("disconnect", () => {
      clearTimeout(expiry);
      subscriptions.delete(socket);
    });
    logger.info("Client connected");
  });
  return io;
};

export const getIO = (): SocketIO => {
  if (!io) throw new AppError("Socket IO not initialized");
  return io;
};
