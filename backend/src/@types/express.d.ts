import Ticket from "../models/Ticket";

declare global {
  namespace Express {
    interface Request {
      user: { id: string; profile: string };
      ticket?: Ticket;
    }
  }
}

export {};
