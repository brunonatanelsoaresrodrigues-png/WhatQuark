import Queue from "../models/Queue";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";

interface SerializedUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  canAccessQuarkClinic: boolean;
  canViewOtherAgentsTickets: boolean;
  whatsappId: number | null;
  hasAvatar: boolean;
  avatarUpdatedAt: Date;
  queues: Queue[];
  whatsapp: Whatsapp;
}

export const SerializeUser = (user: User): SerializedUser => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    canAccessQuarkClinic: user.canAccessQuarkClinic,
    canViewOtherAgentsTickets: user.canViewOtherAgentsTickets,
    whatsappId: user.whatsappId || null,
    hasAvatar: Boolean(user.avatar),
    avatarUpdatedAt: user.updatedAt,
    queues: user.queues,
    whatsapp: user.whatsapp
  };
};
