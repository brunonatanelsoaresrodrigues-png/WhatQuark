export function isMessageSendBlocked(context) {
  if (!context) return false;

  return Boolean(
    context.paused ||
      ["off", "simulation"].includes(context.mode) ||
      (context.official && !context.serviceWindowOpen)
  );
}

export function getComposerAvailability({
  loading,
  recording,
  hasRecordedAudio,
  ticketStatus,
  sendBlocked
}) {
  const composeDisabled = Boolean(
    loading || recording || hasRecordedAudio || ticketStatus !== "open"
  );

  return {
    composeDisabled,
    sendDisabled: composeDisabled || Boolean(sendBlocked)
  };
}
