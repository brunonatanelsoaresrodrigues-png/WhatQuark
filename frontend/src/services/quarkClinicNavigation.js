export const buildQuarkAppointmentPath = (appointmentId, ticketId) => {
  const params = new URLSearchParams();
  params.set("appointmentId", String(appointmentId));
  if (ticketId !== undefined && ticketId !== null && String(ticketId)) {
    params.set("returnTo", `/tickets/${ticketId}`);
  }
  return `/quark-clinic?${params.toString()}`;
};

export const safeQuarkReturnPath = (value) =>
  /^\/tickets\/\d+$/.test(value || "") ? value : null;
