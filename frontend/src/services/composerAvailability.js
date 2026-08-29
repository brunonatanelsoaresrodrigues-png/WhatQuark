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
