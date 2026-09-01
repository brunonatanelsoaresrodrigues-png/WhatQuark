import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography
} from "@material-ui/core";
import api from "../../services/api";
import toastError from "../../errors/toastError";

export default function HistorySyncButton({ whatsapp }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const [starting, setStarting] = useState(false);
  const running = starting || status?.status === "running";
  useEffect(() => {
    let active = true,
      timer;
    const read = async () => {
      try {
        const { data } = await api.get(`/whatsapp/${whatsapp.id}/history-sync`);
        if (!active) return;
        setStatus(data);
        if (data.status === "running") timer = setTimeout(read, 4000);
      } catch (error) {
        if (active) toastError(error);
      }
    };
    if (open) read();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, whatsapp.id, starting]);
  const start = async () => {
    setStarting(true);
    try {
      const { data } = await api.post(`/whatsapp/${whatsapp.id}/history-sync`);
      setStatus(data);
    } catch (error) {
      toastError(error);
    } finally {
      setStarting(false);
    }
  };
  return (
    <>
      <Button
        size="small"
        disabled={whatsapp.status !== "CONNECTED"}
        onClick={() => setOpen(true)}
      >
        Histórico
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Sincronizar histórico</DialogTitle>
        <DialogContent>
          <Typography>
            Importa mensagens ainda disponíveis na conexão atual. Mensagens
            existentes são preservadas; o histórico importado não aciona o bot
            nem envia respostas.
          </Typography>
          <Typography
            variant="body2"
            color="textSecondary"
            style={{ marginTop: 16 }}
          >
            A disponibilidade de mensagens antigas depende do WhatsApp.
          </Typography>
          {status && status.status !== "idle" && (
            <Typography role="status" style={{ marginTop: 16 }}>
              {status.status === "running"
                ? "Sincronizando"
                : status.status === "completed"
                ? "Concluído"
                : "Não foi possível concluir"}
              : {status.processedChats || 0} de {status.totalChats || 0}{" "}
              conversas; {status.importedMessages || 0} mensagens importadas.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Fechar</Button>
          <Button
            color="primary"
            variant="contained"
            disabled={running}
            onClick={start}
          >
            {running ? "Sincronizando…" : "Iniciar sincronização"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
