import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Collapse,
  Paper,
  Typography
} from "@material-ui/core";
import api from "../../services/api";
import toastError from "../../errors/toastError";
export default function MessagingSafetyPanel() {
  const [state, setState] = useState(null);
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [status, outbox] = await Promise.all([
        api.get("/messaging/status"),
        api.get("/messaging/outbox")
      ]);
      setState(status.data);
      setRows(outbox.data);
    } catch (e) {
      toastError(e);
    }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);
  const pause = async () => {
    setBusy(true);
    try {
      await api.post("/messaging/pause", { paused: !state.paused });
      await load();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  const labels = {
    simulation: "Simulação",
    off: "Desativado",
    test: "Teste restrito",
    production: "Produção"
  };
  return (
    <Paper variant="outlined" style={{ padding: 16, marginBottom: 16 }}>
      <Box
        display="flex"
        alignItems="center"
        flexWrap="wrap"
        style={{ gap: 10 }}
      >
        <Typography
          variant="subtitle1"
          style={{ fontWeight: 700, flex: "1 1 180px" }}
        >
          Segurança dos envios
        </Typography>
        <Chip
          size="small"
          label={
            state
              ? `${labels[state.mode]}${state.paused ? " · pausado" : ""}`
              : "Verificando…"
          }
        />
        <Button disabled={!state || busy} variant="outlined" onClick={pause}>
          {state?.paused ? "Retomar fila" : "Pausar envios"}
        </Button>
        <Button
          size="small"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
        >
          {expanded
            ? "Ocultar pendências"
            : `Ver pendências recentes (${rows.length})`}
        </Button>
      </Box>
      <Typography variant="body2" color="textSecondary">
        {state?.official
          ? "API oficial selecionada."
          : "Conexão não oficial mantida. As proteções reduzem envios indevidos, mas o transporte continua sujeito a restrições."}{" "}
        Nenhuma configuração garante risco zero de bloqueio.
      </Typography>
      {state && ["simulation", "off"].includes(state.mode) && (
        <Typography variant="body2" style={{ marginTop: 8 }}>
          O ambiente está sem envios. Retomar a fila não altera o modo
          configurado no servidor.
        </Typography>
      )}
      <Collapse in={expanded}>
        <Typography
          variant="body2"
          color="textSecondary"
          style={{ marginTop: 12 }}
        >
          Consentimento, janela de atendimento e limites são verificados antes
          de cada envio.
        </Typography>
        <Typography variant="caption">
          Até 100 registros recentes. Resultados desconhecidos exigem
          conferência; não são reenviados automaticamente.
        </Typography>
        {rows.map(row => (
          <Box
            key={row.id}
            py={1}
            style={{ borderTop: "1px solid rgba(128,128,128,.15)" }}
          >
            <Typography variant="body2">
              {row.recipient} ·{" "}
              {
                {
                  PENDING: "Na fila",
                  UNKNOWN: "Conferir resultado",
                  BLOCKED: "Bloqueado pela proteção",
                  FAILED: "Entrega recusada"
                }[row.status]
              }
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {row.errorCode || "Aguardando disponibilidade"} ·{" "}
              {new Date(row.createdAt).toLocaleString("pt-BR")}
            </Typography>
          </Box>
        ))}
        {!rows.length && (
          <Typography variant="body2">Nenhuma pendência encontrada.</Typography>
        )}
      </Collapse>
    </Paper>
  );
}
