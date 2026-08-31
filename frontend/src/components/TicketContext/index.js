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
  Typography,
  makeStyles
} from "@material-ui/core";
import InfoOutlined from "@material-ui/icons/InfoOutlined";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  appointmentDateTimeLabel,
  appointmentDayLabel,
  appointmentStatusLabel
} from "../../services/appointmentDisplay";
import { buildQuarkAppointmentPath } from "../../services/quarkClinicNavigation";
import { isMessageSendBlocked } from "../../services/composerAvailability";

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
    color: theme.modeTokens.brandText,
    background: theme.modeTokens.surfaceTint,
    borderColor: theme.modeTokens.messageOutgoingBorder
  },
  blockedChip: {
    color: theme.palette.error.main,
    background:
      theme.statusTokens.danger.bg,
    borderColor: theme.statusTokens.danger.border
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
    color: theme.modeTokens.brandText,
    fontSize: 12,
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
    fontSize: 12,
    textTransform: "none"
  }
}));
export default function TicketContext({ ticket, context, onRefresh }) {
  const classes = useStyles();
  const history = useHistory();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [ticket.id]);
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
  const noticeLabel = !context
    ? "Verificando segurança de envio…"
    : context.preference?.consent === "REVOKED"
    ? "Avisos desativados pelo paciente"
    : context.appointmentNoticesRequireOptIn &&
      context.preference?.consent !== "GRANTED"
    ? "Sem autorização para avisos"
    : "Avisos de consulta ativos";
  const checking = !context;
  const blocked = isMessageSendBlocked(context);
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
            checking
              ? "Verificando envio"
              : blocked
              ? "Envio indisponível"
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
          {noticeLabel}
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
              Não foi possível consultar o contexto visual. O servidor ainda
              validará a segurança antes de enviar.
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
              <Typography variant="h6">Avisos de consulta</Typography>
              <Typography paragraph>{noticeLabel}</Typography>
              {context.preference?.source && (
                <Typography variant="caption" display="block">
                  Registro: {context.preference.source}
                </Typography>
              )}
              <Typography variant="body2" color="textSecondary">
                {context.preference?.consent === "REVOKED"
                  ? "Este número pediu para não receber avisos. Novos lembretes, alterações e cancelamentos permanecem bloqueados."
                  : "Lembretes, alterações e cancelamentos vinculados a consultas reais no Quark são enviados automaticamente. Para interromper, o paciente pode responder PARAR."}
              </Typography>
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
