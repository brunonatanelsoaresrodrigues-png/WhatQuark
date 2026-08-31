import React, { useEffect, useState } from "react";
import {
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  TextField,
  Tooltip,
  Typography,
  makeStyles
} from "@material-ui/core";
import EmojiObjectsIcon from "@material-ui/icons/EmojiObjects";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
  section: { marginTop: theme.spacing(2) },
  list: { margin: theme.spacing(0.5, 0, 0), paddingLeft: theme.spacing(2.5) },
  risks: { display: "flex", flexDirection: "column", gap: theme.spacing(1), marginTop: theme.spacing(1) },
  risk: { display: "flex", alignItems: "flex-start", gap: theme.spacing(1) },
  privacy: { marginTop: theme.spacing(2), padding: theme.spacing(1.5), borderRadius: 8, background: theme.modeTokens.surfaceMuted }
}));

const TicketAssistant = ({ ticketId, disabled, onUseDraft }) => {
  const classes = useStyles();
  const [configured, setConfigured] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [reply, setReply] = useState("");

  useEffect(() => {
    let active = true;
    setConfigured(false);
    api.get(`/tickets/${ticketId}/assistant/status`)
      .then(response => active && setConfigured(Boolean(response.data.enabled)))
      .catch(() => active && setConfigured(false));
    return () => { active = false; };
  }, [ticketId]);

  const generate = async () => {
    setLoading(true);
    try {
      if (suggestion?.id) {
        await api.patch(`/tickets/${ticketId}/assistant/suggestions/${suggestion.id}`, { action: "DISCARDED" });
      }
      const response = await api.post(`/tickets/${ticketId}/assistant/suggestions`);
      setSuggestion(response.data);
      setReply(response.data.respostaSugerida || "");
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const close = async () => {
    if (suggestion?.id) {
      try { await api.patch(`/tickets/${ticketId}/assistant/suggestions/${suggestion.id}`, { action: "DISCARDED" }); } catch {}
    }
    setOpen(false);
    setSuggestion(null);
    setReply("");
  };

  const useDraft = async () => {
    if (!reply.trim() || !suggestion?.id) return;
    try {
      await api.patch(`/tickets/${ticketId}/assistant/suggestions/${suggestion.id}`, { action: "COPIED", editedOutput: reply.trim() });
      onUseDraft(reply.trim());
      setOpen(false);
      setSuggestion(null);
      setReply("");
    } catch (err) {
      toastError(err);
    }
  };

  const title = configured ? "Assistente inteligente" : "Assistente ainda não configurado pelo administrador";
  return (
    <>
      <Tooltip title={title}>
        <span>
          <IconButton aria-label="Abrir assistente inteligente" disabled={disabled || !configured} onClick={() => setOpen(true)}>
            <EmojiObjectsIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Dialog open={open} onClose={loading ? undefined : close} fullWidth maxWidth="sm">
        <DialogTitle>Assistente inteligente</DialogTitle>
        <DialogContent>
          {!suggestion ? (
            <>
              <Typography>O assistente analisa as mensagens recentes, remove dados sensíveis e prepara um rascunho para sua revisão.</Typography>
              <div className={classes.privacy}>
                <Typography variant="body2"><strong>Nada será enviado automaticamente.</strong> Você continuará responsável por revisar e clicar em enviar.</Typography>
              </div>
            </>
          ) : (
            <>
              <Typography variant="subtitle2">Resumo</Typography>
              <Typography variant="body2">{suggestion.resumo}</Typography>
              <div className={classes.section}>
                <Typography variant="subtitle2">Pendências</Typography>
                {suggestion.pendencias?.length ? <ul className={classes.list}>{suggestion.pendencias.map((item, index) => <li key={`${index}-${item}`}><Typography variant="body2">{item}</Typography></li>)}</ul> : <Typography variant="body2" color="textSecondary">Nenhuma pendência identificada.</Typography>}
              </div>
              <div className={classes.section}>
                <Typography variant="subtitle2">Avisos para revisão</Typography>
                <div className={classes.risks}>
                  {suggestion.riscos?.length ? suggestion.riscos.map((risk, index) => (
                    <div key={`${index}-${risk.tipo}`} className={classes.risk}>
                      <Chip size="small" color={risk.nivel === "alto" ? "secondary" : "default"} label={risk.nivel} />
                      <Typography variant="body2">{risk.descricao}</Typography>
                    </div>
                  )) : <Typography variant="body2" color="textSecondary">Nenhum risco identificado.</Typography>}
                </div>
              </div>
              <Divider className={classes.section} />
              <TextField
                className={classes.section}
                label="Resposta sugerida — edite antes de usar"
                value={reply}
                onChange={event => setReply(event.target.value)}
                multiline
                rows={4}
                fullWidth
                variant="outlined"
              />
              <Typography className={classes.section} variant="caption" color="textSecondary">Dados removidos: {suggestion.dadosRemovidos?.join(", ") || "nenhum detectado"}.</Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={loading} onClick={close}>Cancelar</Button>
          {!suggestion ? (
            <Button color="primary" variant="contained" disabled={loading} startIcon={loading ? <CircularProgress size={16} /> : <EmojiObjectsIcon />} onClick={generate}>Gerar resumo</Button>
          ) : (
            <>
              <Button disabled={loading} onClick={generate}>Gerar novamente</Button>
              <Button color="primary" variant="contained" disabled={!reply.trim()} onClick={useDraft}>Usar no campo de resposta</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TicketAssistant;
