import { sign } from "jsonwebtoken";
import { initIO, emitTicketEvent } from "../../../libs/socket";
import auth from "../../../config/auth";
import { AuthenticateUser } from "../../../services/AuthServices/AuthenticateUser";
import ShowUserService from "../../../services/UserServices/ShowUserService";
import AssertTicketAccess from "../../../services/TicketServices/AssertTicketAccess";

let authenticate: any;
let connect: any;
jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    use: (handler: any) => {
      authenticate = handler;
    },
    on: (_event: string, handler: any) => {
      connect = handler;
    }
  }))
}));
jest.mock("../../../services/AuthServices/AuthenticateUser", () => ({
  AuthenticateUser: jest.fn()
}));
jest.mock("../../../services/UserServices/ShowUserService", () => jest.fn());
jest.mock("../../../services/TicketServices/AssertTicketAccess", () =>
  jest.fn()
);
jest.mock("../../../utils/logger", () => ({ logger: { info: jest.fn() } }));

describe("socket authorization", () => {
  let socket: any;
  let handlers: Record<string, (...args: any[]) => any>;
  const viewer = {
    id: 1,
    profile: "user",
    tokenVersion: 0,
    queues: [{ id: 2 }]
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    (AuthenticateUser as jest.Mock).mockResolvedValue(viewer);
    (ShowUserService as jest.Mock).mockResolvedValue(viewer);
    (AssertTicketAccess as jest.Mock).mockResolvedValue({ id: 10 });
    handlers = {};
    socket = {
      connected: true,
      handshake: {
        auth: {
          token: sign({ id: 1, tokenVersion: 0 }, auth.secret, {
            expiresIn: "15m"
          })
        }
      },
      join: jest.fn(),
      emit: jest.fn(),
      on: (event: string, handler: any) => {
        handlers[event] = handler;
      },
      disconnect: jest.fn(() => {
        socket.connected = false;
        handlers.disconnect?.();
      })
    };
    initIO({} as any);
    await authenticate(socket, (error: Error) => {
      if (error) throw error;
    });
    connect(socket);
  });
  afterEach(() => socket.disconnect());

  it("rejects a forbidden conversation subscription", async () => {
    (AssertTicketAccess as jest.Mock).mockRejectedValue(new Error("denied"));
    await handlers.joinChatBox("10");
    expect(socket.emit).toHaveBeenCalledWith("ticketAccessDenied", {
      ticketId: "10"
    });
  });
  it("does not let clients join administrative rooms through a status", () => {
    handlers.joinTickets("admin");
    expect(socket.join).not.toHaveBeenCalledWith("admin");
  });
  it("filters notification broadcasts and rechecks access after transfer", async () => {
    handlers.joinNotification();
    const ticket = {
      id: 10,
      userId: 1,
      status: "open",
      queueId: 2,
      ticketType: "PATIENT"
    };
    await emitTicketEvent(ticket, "appMessage", { body: "allowed" });
    expect(socket.emit).toHaveBeenCalledWith("appMessage", { body: "allowed" });
    socket.emit.mockClear();
    await emitTicketEvent({ ...ticket, userId: 8 }, "appMessage", {
      body: "private"
    });
    expect(socket.emit).not.toHaveBeenCalled();
  });
  it("removes a transferred conversation from the former viewer", async () => {
    await handlers.joinChatBox("10");
    await emitTicketEvent(
      { id: 10, userId: 8, status: "open", queueId: 2, ticketType: "PATIENT" },
      "ticket",
      { action: "update", secret: "hidden" }
    );
    expect(socket.emit).toHaveBeenCalledWith("ticket", {
      action: "delete",
      ticketId: 10
    });
    expect(socket.emit).not.toHaveBeenCalledWith(
      "ticket",
      expect.objectContaining({ secret: "hidden" })
    );
  });
  it("disconnects revoked sessions before emitting data", async () => {
    handlers.joinNotification();
    (AuthenticateUser as jest.Mock).mockRejectedValue(new Error("revoked"));
    await emitTicketEvent(
      { id: 10, userId: 1, status: "open", queueId: 2 },
      "appMessage",
      { body: "private" }
    );
    expect(socket.disconnect).toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
  });
});
