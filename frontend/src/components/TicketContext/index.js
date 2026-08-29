import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  TextField,
  Typography,
  makeStyles
} from "@material-ui/core";
import InfoOutlined from "@material-ui/icons/InfoOutlined";
import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  appointmentDateTimeLabel,
  appointmentDayLabel,
  appointmentStatusLabel
} from "../../services/appointmentDisplay";
import { buildQuarkAppointmentPath } from "../../services/quarkClinicNavigation";

const useStyles = makeStyles(theme => ({
  contextBar: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    minHeight: 42,
    padding: theme.spacing(0.65, 1.5),
    gap: theme.spacing(1),
    background: theme.modeTokens.surfaceMuted,
    borderBottom: `1px solid ${theme.palette.divider}`
  },
  contextCopy: { flex: 1, minWidth: 160 },
  activeChip: {
    color: theme.palette.type === "dark" ? "#8EE3D6" : "#075E57",
    background: theme.modeTokens.surfaceTint,
    borderColor: "rgba(12,124,114,.24)"
  },
  blockedChip: {
    color: theme.palette.error.main,
    background:
      theme.palette.type === "dark" ? "rgba(198,75,85,.12)" : "#FFF0F1",
    borderColor: "rgba(198,75,85,.24)"
  },
  appointmentHeading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(0.75)
  },
  appointmentDay: {
    display: "inline-flex",
    padding: theme.spacing(0.25, 0.8),
    borderRadius: 999,
    background: theme.modeTokens.surfaceTint,
    color: theme.palette.type === "dark" ? "#8EE3D6" : "#075E57",
    fontSize: 11,
    fontWeight: 700
  },
  appointmentFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1)
  },
  quarkButton: {
    minWidth: 0,
    padding: theme.spacing(0.25, 0.5),
    fontSize: 11,
    textTransform: "none"
  }
}));
export default function TicketContext({ ticket, context, onRefresh }) {
  const classes = useStyles();
  const history = useHistory();
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState("");
  const [relationship, setRelationship] = useState("Próprio paciente");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setOpen(false);
    setEvidence("");
  }, [ticket.id]);
  const save = async consent => {
    setSaving(true);
    try {
      await api.put(`/tickets/${ticket.id}/preference`, {
        consent,
        evidence,
        relationship
      });
      await onRefresh();
      setEvidence("");
      toast.success("Preferência registrada com histórico de autorização.");
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };
  const bot = async () => {
    setSaving(true);
    try {
      await api.put(`/tickets/${ticket.id}/bot`, {
        paused: !context.botPaused
      });
      await onRefresh();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };
  const labels = {
    GRANTED: "Avisos autorizados",
    REVOKED: "Avisos desativados",
    UNKNOWN: "Sem autorização para avisos"
  };
  const blocked =
    !context || context.paused || ["off", "simulation"].includes(context.mode);
  const appointment = value => (
    <Box key={value.appointmentId} py={1}>
      <div className={classes.appointmentHeading}>
        <Typography variant="body2">
          {appointmentDateTimeLabel(value.scheduledAt, context?.clinicTimezone)}
        </Typography>
        <span className={classes.appointmentDay}>
          {appointmentDayLabel(
            value.scheduledAt,
            context?.serverNow,
            context?.clinicTimezone
          )}
        </span>
      </div>
      <div className={classes.appointmentFooter}>
        <Typography variant="caption" color="textSecondary">
          {appointmentStatusLabel(value.status)} · Referência {value.reference}
        </Typography>
        <Button
          className={classes.quarkButton}
          color="primary"
          size="small"
          onClick={() => {
            setOpen(false);
            history.push(buildQuarkAppointmentPath(value.appointmentId, ticket.id));
          }}
        >
          Ver no Quark
        </Button>
      </div>
    </Box>
  );
  return (
    <>
      <Box className={classes.contextBar}>
        <Chip
          size="small"
          variant="outlined"
          className={blocked ? classes.blockedChip : classes.activeChip}
          label={
            blocked
              ? "Envios pausados"
              : context?.botPaused
              ? "Atendimento humano"
              : "Assistente ativo"
          }
        />
        <Typography
          variant="caption"
          color="textSecondary"
          className={classes.contextCopy}
        >
          {context
            ? labels[context.preference?.consent || "UNKNOWN"]
            : "Verificando segurança de envio…"}
        </Typography>
        <Button
          size="small"
          startIcon={<InfoOutlined />}
          onClick={() => setOpen(true)}
        >
          Contexto
        </Button>
      </Box>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="patient-context-title"
      >
        <DialogTitle id="patient-context-title">
          Contexto do atendimento
        </DialogTitle>
        <DialogContent dividers>
          {!context ? (
            <Typography>
              Não foi possível consultar o contexto. Atualize antes de enviar.
            </Typography>
          ) : (
            <>
              <Typography variant="subtitle1">
                {ticket.contact?.name}
              </Typography>
              <Typography color="textSecondary" paragraph>
                {context.official
                  ? "WhatsApp Cloud API"
                  : "Conexão não oficial — há risco de restrição"}{" "}
                ·{" "}
                {context.mode === "production"
                  ? "Produção"
                  : context.mode === "test"
                  ? "Teste restrito"
                  : "Simulação / pausado"}
              </Typography>
              {context.automationReview && (
                <Typography paragraph color="error">
                  Automação requer conferência:{" "}
                  {context.automationReview.errorCode}. Confira o histórico
                  antes de retomar.
                </Typography>
              )}
              <Typography paragraph>
                {context.serviceWindowOpen
                  ? "Janela de atendimento aberta. A resposta deve estar relacionada ao pedido do paciente."
                  : "Fora da janela de 24 horas. Na API oficial, é necessário um modelo aprovado para iniciar uma conversa."}
              </Typography>
              <Button
                variant="outlined"
                onClick={bot}
                disabled={saving || !!ticket.userId}
              >
                {context.botPaused ? "Retomar assistente" : "Pausar assistente"}
              </Button>
              {!!ticket.userId && (
                <Typography variant="caption" display="block">
                  O assistente fica pausado enquanto há um atendente
                  responsável.
                </Typography>
              )}
              {!!context.outbound?.length && (
                <Box mt={2}>
                  <Typography variant="h6">Pendências de envio</Typography>
                  {context.outbound.map(item => (
                    <Typography key={item.id} variant="body2">
                      {
                        {
                          PENDING: "Na fila",
                          PROCESSING: "Enviando",
                          UNKNOWN: "Resultado incerto — não reenviar",
                          BLOCKED: "Envio bloqueado",
                          FAILED: "Entrega recusada"
                        }[item.status]
                      }
                      {item.errorCode ? ` · ${item.errorCode}` : ""}
                    </Typography>
                  ))}
                </Box>
              )}
              <Box my={2}>
                <Divider />
              </Box>
              {context.lastAppointment && (
                <>
                  <Typography variant="h6">Última consulta</Typography>
                  {appointment(context.lastAppointment)}
                  <Box my={2}>
                    <Divider />
                  </Box>
                </>
              )}
              <Typography variant="h6">Próximas consultas</Typography>
              {context.appointments?.length ? (
                context.appointments.map(appointment)
              ) : (
                <Typography color="textSecondary">
                  Nenhuma consulta futura vinculada a este número.
                </Typography>
              )}
              <Box my={2}>
                <Divider />
              </Box>
              <Typography variant="h6">Autorização para avisos</Typography>
              <Typography paragraph>
                {labels[context.preference?.consent || "UNKNOWN"]}
              </Typography>
              {context.preference?.source && (
                <Typography variant="caption" display="block">
                  Registro: {context.preference.source}
                </Typography>
              )}
              <Typography variant="body2" color="textSecondary">
                Só registre autorização após o paciente permitir avisos de
                consulta neste número. O paciente também pode responder AUTORIZO
                AVISOS DE CONSULTA ou PARAR.
              </Typography>
              <TextField
                id="consent-relationship"
                fullWidth
                margin="normal"
                label="Titular do número / relação com o paciente"
                value={relationship}
                onChange={e => setRelationship(e.target.value)}
              />
              <TextField
                id="consent-evidence"
                fullWidth
                multiline
                margin="normal"
                label="Como e quando a preferência foi informada?"
                helperText="Descreva a evidência, sem informações clínicas."
                value={evidence}
                onChange={e => setEvidence(e.target.value)}
                inputProps={{ maxLength: 500 }}
              />
              <Box display="flex" flexWrap="wrap" style={{ gap: 8 }}>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={
                    saving ||
                    evidence.trim().length < 10 ||
                    !relationship.trim()
                  }
                  onClick={() => save("GRANTED")}
                >
                  Registrar autorização
                </Button>
                <Button
                  disabled={
                    saving ||
                    evidence.trim().length < 10 ||
                    !relationship.trim()
                  }
                  onClick={() => save("REVOKED")}
                >
                  Desativar avisos
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onRefresh}>Atualizar</Button>
          <Button onClick={() => setOpen(false)} color="primary">
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
