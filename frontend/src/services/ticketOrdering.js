const timestamp = value => {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
};

const ticketTime = ticket =>
  timestamp(ticket?.sortAt || ticket?.updatedAt || ticket?.createdAt);

export const sortAtAfterUnreadUpdate = (previous, incoming) => {
  if (incoming?.status !== "pending") {
    return incoming?.sortAt || incoming?.updatedAt;
  }

  const wasAlreadyWaiting = Number(previous?.unreadMessages || 0) > 0;
  return wasAlreadyWaiting
    ? previous?.sortAt || incoming?.sortAt || incoming?.updatedAt
    : incoming?.sortAt || incoming?.updatedAt;
};

export const sortTickets = (tickets, status) => {
  const direction = status === "pending" ? 1 : -1;

  return [...(Array.isArray(tickets) ? tickets : [])].sort((left, right) => {
    const byTime = ticketTime(left) - ticketTime(right);
    if (byTime) return byTime * direction;

    const leftId = Number(left?.id) || 0;
    const rightId = Number(right?.id) || 0;
    return (leftId - rightId) * direction;
  });
};
