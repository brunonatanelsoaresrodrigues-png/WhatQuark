let stopping = false;
export const beginShutdown = () => {
  stopping = true;
};
export const isShuttingDown = () => stopping;
export const assertNotShuttingDown = () => {
  if (stopping) throw new Error("ERR_SHUTTING_DOWN");
};
