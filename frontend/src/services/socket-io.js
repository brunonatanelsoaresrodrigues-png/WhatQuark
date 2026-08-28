import openSocket from "socket.io-client";
import { getBackendUrl } from "../config";
import { getAccessToken, refreshSession } from "./api";

export default function connectToSocket() {
  let disposed = false;
  let reconnecting = false;
  const socket = openSocket(getBackendUrl(), {
    transports: ["websocket", "polling"],
    auth: callback => callback({ token: getAccessToken() })
  });
  const reconnect = async () => {
    if (disposed || reconnecting || !getAccessToken()) return;
    reconnecting = true;
    try {
      await refreshSession();
      if (!disposed) socket.connect();
    } catch {
      /* The shared auth handler clears an expired session. */
    } finally {
      reconnecting = false;
    }
  };
  socket.on("connect_error", error => {
    if (error.message === "ERR_SESSION_EXPIRED") reconnect();
  });
  socket.on("disconnect", reason => {
    if (reason === "io server disconnect") reconnect();
  });
  const disconnect = socket.disconnect.bind(socket);
  socket.disconnect = () => {
    disposed = true;
    return disconnect();
  };
  return socket;
}
