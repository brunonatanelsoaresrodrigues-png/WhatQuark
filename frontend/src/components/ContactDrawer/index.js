import React, { useContext, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  makeStyles,
  Typography,
  IconButton,
  Drawer,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Button,
  Paper,
  CircularProgress,
  Tooltip,
} from "@material-ui/core";
import {
  ArrowForward,
  CheckCircleOutline,
  Close,
  EditOutlined,
  ErrorOutline,
  FileCopyOutlined,
  InfoOutlined,
  Refresh,
  Visibility,
  VisibilityOff,
  WhatsApp,
} from "@material-ui/icons";
import Skeleton from "@material-ui/lab/Skeleton";
import { toast } from "react-toastify";
import ContactModal from "../ContactModal";
import ContactAvatar from "../ContactAvatar";
import MarkdownWrapper from "../MarkdownWrapper";
import {
  appointmentDateTimeLabel,
  appointmentDayLabel,
  appointmentConfirmationDisabledReason,
  appointmentStatusLabel,
} from "../../services/appointmentDisplay";
import { formatQuarkPhone } from "../../services/quarkAgendaDisplay";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import {
  buildQuarkAppointmentPath,
  buildQuarkPatientPath,
} from "../../services/quarkClinicNavigation";
import {
  isQuarkPatientAmbiguous,
  isQuarkPatientNotFound,
} from "../../services/quarkClinicErrors";
import {
  contactDisplayName,
  contactPhoneLabel,
  isUnresolvedWhatsAppIdentity,
} from "../../services/contactIdentity";
const useStyles = makeStyles((theme) => ({
  docked: {
    width: 288,
    flexShrink: 0,
    height: "100%",
  },
  drawerPaper: {
    width: 320,
    maxWidth: "100vw",
    height: "100%",
    overflow: "hidden",
    borderLeft: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
  },
  dockedPaper: {
    position: "relative",
    width: 288,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px",
    minHeight: 48,
    flexShrink: 0,
    borderBottom: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
    zIndex: 1,
    "& h2": {
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: ".08em",
      textTransform: "uppercase",
      color: theme.palette.text.secondary,
    },
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: "0 14px 18px",
    ...theme.scrollbarStyles,
  },
  contactHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 2px 14px",
  },
  avatar: {
    width: 52,
    height: 52,
    fontSize: 17,
    boxShadow: `0 0 0 3px ${theme.modeTokens.surfaceTint}`,
  },
  identity: {
    minWidth: 0,
    flex: 1,
    "& h3": {
      fontSize: 15,
      fontWeight: 700,
      lineHeight: 1.25,
      overflowWrap: "anywhere",
    },
  },
  channel: {
    display: "inline-flex",
    gap: 4,
    alignItems: "center",
    marginTop: 6,
    padding: "2px 7px 2px 5px",
    borderRadius: 999,
    background: theme.modeTokens.surfaceTint,
    fontSize: 12,
    fontWeight: 600,
    color: theme.palette.success.main,
    "& svg": {
      fontSize: 14,
    },
  },
  editButton: {
    width: "100%",
    minHeight: 34,
    borderRadius: 9,
    fontSize: 12,
    fontWeight: 600,
    textTransform: "none",
  },
  card: {
    marginTop: 12,
    padding: 14,
    borderRadius: 10,
    boxShadow: "none",
    background: theme.modeTokens.surfaceMuted,
    "& h3": {
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: ".02em",
      marginBottom: 14,
    },
  },
  details: {
    display: "grid",
    gridTemplateColumns: "76px minmax(0, 1fr)",
    gap: "11px 8px",
    margin: 0,
    fontSize: 12,
    lineHeight: 1.5,
    "& dt": {
      color: theme.palette.text.secondary,
    },
    "& dd": {
      margin: 0,
      minWidth: 0,
      fontWeight: 500,
      overflowWrap: "anywhere",
    },
  },
  pendingValue: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: theme.palette.text.secondary,
    fontWeight: 400,
  },
  sensitiveValue: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    minWidth: 0,
  },
  sensitiveText: {
    minWidth: 0,
    overflowWrap: "anywhere",
    fontVariantNumeric: "tabular-nums",
  },
  sensitiveActions: {
    display: "inline-flex",
    flexShrink: 0,
    gap: 2,
    "& .MuiIconButton-root": {
      width: 30,
      height: 30,
      padding: 5,
    },
  },
  sourceBadge: {
    display: "flex",
    alignItems: "center",
    width: "fit-content",
    gap: 4,
    marginTop: 4,
    padding: "2px 6px",
    borderRadius: 999,
    background: theme.modeTokens.surfaceTint,
    color: theme.palette.primary.main,
    fontSize: 12,
    fontWeight: 700,
    "& svg": {
      fontSize: 12,
    },
  },
  syncStatus: {
    display: "grid",
    gridTemplateColumns: "14px minmax(0, 1fr)",
    alignItems: "start",
    columnGap: 5,
    rowGap: 4,
    marginTop: 5,
    color: theme.palette.text.secondary,
    fontSize: 12,
    lineHeight: 1.45,
    "& svg, & .MuiCircularProgress-root": {
      flexShrink: 0,
      fontSize: 14,
      marginTop: 2,
    },
  },
  statusText: {
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  syncSuccess: {
    color: theme.statusTokens.success.fg,
  },
  syncError: {
    color: theme.statusTokens.danger.fg,
  },
  retryButton: {
    gridColumn: 2,
    justifySelf: "start",
    minWidth: 0,
    minHeight: 28,
    padding: "2px 4px",
    fontSize: 12,
    lineHeight: 1.3,
    textTransform: "none",
    whiteSpace: "nowrap",
    "& .MuiButton-startIcon": {
      marginLeft: 0,
      marginRight: 4,
    },
  },
  extraInfo: {
    padding: "8px 0",
    borderTop: `1px solid ${theme.palette.divider}`,
    fontSize: 12,
    overflowWrap: "anywhere",
    "&:first-of-type": {
      borderTop: 0,
      paddingTop: 0,
    },
  },
  appointmentItem: {
    padding: "2px 0 10px",
    fontSize: 12,
    "& + &": {
      paddingTop: 10,
      borderTop: `1px solid ${theme.palette.divider}`,
    },
    "&:last-child": {
      paddingBottom: 0,
    },
  },
  appointmentHeading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
  },
  appointmentDay: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 22,
    padding: "2px 7px",
    borderRadius: 999,
    background: theme.modeTokens.surfaceTint,
    color: theme.modeTokens.brandText,
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  appointmentMeta: {
    display: "block",
    marginTop: 4,
  },
  appointmentFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  appointmentActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 4,
  },
  quarkButton: {
    minWidth: 0,
    padding: "2px 4px",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "none",
  },
  confirmButton: {
    minWidth: 0,
    padding: "3px 8px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    textTransform: "none",
    "& .MuiButton-startIcon": {
      marginRight: 4,
      "& svg": { fontSize: 16 },
    },
  },
  empty: {
    fontSize: 12,
    lineHeight: 1.7,
    color: theme.palette.text.secondary,
  },
  quarkSource: {
    display: "block",
    marginTop: 2,
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  quarkLink: {
    marginTop: 12,
    marginLeft: -6,
    padding: "4px 6px",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "none",
  },
}));
const ContactDrawer = ({
  open,
  docked = false,
  handleDrawerClose,
  contact,
  loading,
  ticket,
  context,
  onContextRefresh,
}) => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const [modalOpen, setModalOpen] = useState(false);
  const [quarkPatient, setQuarkPatient] = useState(null);
  const [quarkLoading, setQuarkLoading] = useState(false);
  const [quarkError, setQuarkError] = useState(false);
  const [quarkNotFound, setQuarkNotFound] = useState(false);
  const [quarkAmbiguous, setQuarkAmbiguous] = useState(false);
  const [quarkReload, setQuarkReload] = useState(0);
  const [importedCpf, setImportedCpf] = useState("");
  const [cpfSyncState, setCpfSyncState] = useState("idle");
  const [cpfVisible, setCpfVisible] = useState(false);
  const [cpfCopied, setCpfCopied] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [confirmingAppointment, setConfirmingAppointment] = useState(null);
  const unresolvedWhatsAppIdentity = isUnresolvedWhatsAppIdentity(contact);
  const canConfirmInQuark =
    user?.profile === "admin" || Boolean(user?.canAccessQuarkClinic);

  useEffect(() => {
    setConfirmation(null);
    setConfirmingAppointment(null);
  }, [ticket?.id]);

  useEffect(() => {
    let active = true;
    setQuarkPatient(null);
    setQuarkError(false);
    setQuarkNotFound(false);
    setQuarkAmbiguous(false);
    setImportedCpf("");
    setCpfSyncState("idle");
    setCpfVisible(false);
    setCpfCopied(false);
    if (
      !open ||
      !contact?.id ||
      !user?.canAccessQuarkClinic ||
      unresolvedWhatsAppIdentity
    ) {
      setQuarkLoading(false);
      return () => {
        active = false;
      };
    }
    setQuarkLoading(true);
    api
      .get(`/quark/clinic/contacts/${contact.id}`)
      .then(({ data }) => {
        if (!active) return;
        setQuarkNotFound(false);
        setQuarkAmbiguous(false);
        setQuarkPatient(data);
        if (data.cpf && !contact.cpf) {
          setCpfSyncState("saving");
          api
            .put(`/contacts/${contact.id}`, { cpf: data.cpf })
            .then(() => {
              if (!active) return;
              setImportedCpf(data.cpf);
              setCpfSyncState("saved");
            })
            .catch(() => {
              if (active) setCpfSyncState("error");
            });
        }
      })
      .catch((error) => {
        if (!active) return;
        setQuarkPatient(null);
        if (isQuarkPatientNotFound(error)) {
          setQuarkNotFound(true);
          setQuarkAmbiguous(false);
          setQuarkError(false);
          return;
        }
        if (isQuarkPatientAmbiguous(error)) {
          setQuarkNotFound(false);
          setQuarkAmbiguous(true);
          setQuarkError(false);
          return;
        }
        setQuarkNotFound(false);
        setQuarkAmbiguous(false);
        setQuarkError(true);
      })
      .finally(() => {
        if (active) setQuarkLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    open,
    contact?.id,
    contact?.cpf,
    user?.canAccessQuarkClinic,
    quarkReload,
    unresolvedWhatsAppIdentity,
  ]);

  const formatCpf = (value) => {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length !== 11) return value || "";
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
      6,
      9
    )}-${digits.slice(9)}`;
  };
  const cpf = contact.cpf || importedCpf || quarkPatient?.cpf;
  const cpfPending = quarkLoading && !cpf;
  const formattedCpf = formatCpf(cpf);
  const copyCpf = async () => {
    if (!cpf) return;
    try {
      await navigator.clipboard.writeText(String(cpf));
      setCpfCopied(true);
      window.setTimeout(() => setCpfCopied(false), 1800);
    } catch (err) {
      setCpfCopied(false);
    }
  };
  const retryCpfSync = async () => {
    if (!contact?.id || !quarkPatient?.cpf) return;
    setCpfSyncState("saving");
    try {
      await api.put(`/contacts/${contact.id}`, { cpf: quarkPatient.cpf });
      setImportedCpf(quarkPatient.cpf);
      setCpfSyncState("saved");
    } catch (err) {
      setCpfSyncState("error");
    }
  };
  const confirmAppointment = async appointment => {
    setConfirmingAppointment(appointment.appointmentId);
    try {
      await api.post(
        `/quark/dashboard/appointments/${encodeURIComponent(
          appointment.appointmentId
        )}/confirm`
      );
      toast.success("Consulta confirmada com sucesso no Quark.");
      setConfirmation(null);
      if (onContextRefresh) await onContextRefresh();
    } catch (error) {
      toastError(error);
    } finally {
      setConfirmingAppointment(null);
    }
  };
  const renderAppointment = (appointment, allowConfirmation = false) => {
    const confirmationDisabledReason =
      appointmentConfirmationDisabledReason(appointment);
    return (
      <div key={appointment.appointmentId} className={classes.appointmentItem}>
      <div className={classes.appointmentHeading}>
        <span>
          {appointmentDateTimeLabel(
            appointment.scheduledAt,
            context?.clinicTimezone
          )}
        </span>
        <span className={classes.appointmentDay}>
          {appointmentDayLabel(
            appointment.scheduledAt,
            context?.serverNow,
            context?.clinicTimezone
          )}
        </span>
      </div>
      <div className={classes.appointmentFooter}>
        <Typography
          variant="caption"
          color="textSecondary"
          className={classes.appointmentMeta}
        >
          {appointmentStatusLabel(appointment.status)} · {appointment.reference}
        </Typography>
        <div className={classes.appointmentActions}>
          <Button
            className={classes.quarkButton}
            color="primary"
            size="small"
            onClick={() =>
              history.push(
                buildQuarkAppointmentPath(appointment.appointmentId, ticket?.id)
              )
            }
          >
            Ver no Quark
          </Button>
          {allowConfirmation && canConfirmInQuark && (
            <Tooltip
              title={
                confirmationDisabledReason ||
                "Confirmar esta consulta diretamente no Quark"
              }
            >
              <span>
                <Button
                  className={classes.confirmButton}
                  color="primary"
                  size="small"
                  variant="contained"
                  startIcon={
                    confirmingAppointment === appointment.appointmentId ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <CheckCircleOutline />
                    )
                  }
                  disabled={
                    Boolean(confirmationDisabledReason) ||
                    confirmingAppointment !== null
                  }
                  onClick={() => setConfirmation(appointment)}
                >
                  Confirmar
                </Button>
              </span>
            </Tooltip>
          )}
        </div>
      </div>
      </div>
    );
  };
  return (
    <>
      <Drawer
        className={docked && open ? classes.docked : undefined}
        variant={docked ? "persistent" : "temporary"}
        onClose={handleDrawerClose}
        anchor="right"
        open={open}
        classes={{
          paper: `${classes.drawerPaper} ${docked ? classes.dockedPaper : ""}`,
        }}
        PaperProps={{
          component: "aside",
          "aria-label": "Detalhes do contato",
        }}
      >
      <div className={classes.header}>
        <Typography component="h2">Detalhes do contato</Typography>
        <IconButton
          size="small"
          aria-label="Fechar detalhes do contato"
          onClick={handleDrawerClose}
        >
          <Close fontSize="small" />
        </IconButton>
      </div>
      <div className={classes.content}>
        {loading ? (
          <>
            <Skeleton variant="circle" width={52} height={52} />
            <Skeleton height={42} />
            <Skeleton variant="rect" height={180} />
          </>
        ) : (
          <>
            <div className={classes.contactHeader}>
              <ContactAvatar contact={contact} className={classes.avatar} />
              <div className={classes.identity}>
                <Typography component="h3">
                  {contactDisplayName(contact, "Contato")}
                </Typography>
                <div className={classes.channel}>
                  <WhatsApp /> WhatsApp
                </div>
              </div>
            </div>
            <Button
              className={classes.editButton}
              variant="outlined"
              startIcon={<EditOutlined />}
              onClick={() => setModalOpen(true)}
            >
              Editar contato
            </Button>
            <Paper variant="outlined" className={classes.card}>
              <Typography component="h3">Informações do contato</Typography>
              <dl className={classes.details}>
                <dt>Nome</dt>
                <dd>{contactDisplayName(contact, "Não informado")}</dd>
                <dt>Telefone</dt>
                <dd>
                  {contact.number && !unresolvedWhatsAppIdentity ? (
                    <Link href={`tel:${contact.number}`}>
                      {contactPhoneLabel(contact, formatQuarkPhone)}
                    </Link>
                  ) : (
                    contactPhoneLabel(contact, formatQuarkPhone)
                  )}
                </dd>
                <dt>E-mail</dt>
                <dd>{contact.email || "Não informado"}</dd>
                <dt>CPF</dt>
                <dd aria-busy={cpfPending || undefined}>
                  {cpfPending ? (
                    <span className={classes.pendingValue}>
                      <CircularProgress size={11} color="inherit" />
                      Consultando…
                    </span>
                  ) : formattedCpf ? (
                    <span className={classes.sensitiveValue}>
                      <span className={classes.sensitiveText}>
                        {cpfVisible ? formattedCpf : "•••.•••.•••-••"}
                      </span>
                      <span className={classes.sensitiveActions}>
                        <Tooltip title={cpfVisible ? "Ocultar CPF" : "Revelar CPF"}>
                          <IconButton
                            size="small"
                            aria-label={cpfVisible ? "Ocultar CPF" : "Revelar CPF"}
                            onClick={() => setCpfVisible(value => !value)}
                          >
                            {cpfVisible ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={cpfCopied ? "CPF copiado" : "Copiar CPF"}>
                          <IconButton
                            size="small"
                            aria-label={cpfCopied ? "CPF copiado" : "Copiar CPF"}
                            onClick={copyCpf}
                          >
                            <FileCopyOutlined />
                          </IconButton>
                        </Tooltip>
                      </span>
                    </span>
                  ) : (
                    "Não informado"
                  )}
                  {cpfSyncState === "saving" && (
                    <span className={classes.syncStatus} aria-live="polite">
                      <CircularProgress size={12} color="inherit" />
                      <span className={classes.statusText}>Salvando no contato…</span>
                    </span>
                  )}
                  {cpfSyncState === "saved" && (
                    <span className={`${classes.syncStatus} ${classes.syncSuccess}`} aria-live="polite">
                      <CheckCircleOutline />
                      <span className={classes.statusText}>Sincronizado do Quark</span>
                    </span>
                  )}
                  {cpfSyncState === "error" && (
                    <span className={`${classes.syncStatus} ${classes.syncError}`} role="alert">
                      <ErrorOutline />
                      <span className={classes.statusText}>
                        Encontrado no Quark, mas não salvo.
                      </span>
                      <Button
                        className={classes.retryButton}
                        size="small"
                        startIcon={<Refresh />}
                        onClick={retryCpfSync}
                      >
                        Tentar novamente
                      </Button>
                    </span>
                  )}
                  {quarkNotFound && !cpf && (
                    <span className={classes.syncStatus} aria-live="polite">
                      <InfoOutlined />
                      <span className={classes.statusText}>
                        Sem cadastro vinculado no Quark.
                      </span>
                    </span>
                  )}
                  {quarkAmbiguous && !cpf && (
                    <span className={`${classes.syncStatus} ${classes.syncError}`} role="alert">
                      <ErrorOutline />
                      <span className={classes.statusText}>
                        Este telefone está vinculado a mais de um paciente no Quark. Confirme o cadastro antes de importar o CPF.
                      </span>
                    </span>
                  )}
                  {unresolvedWhatsAppIdentity && !cpf && (
                    <span className={classes.syncStatus} aria-live="polite">
                      <InfoOutlined />
                      <span className={classes.statusText}>
                        O CPF será consultado quando o WhatsApp informar o telefone real.
                      </span>
                    </span>
                  )}
                  {quarkError && !cpf && (
                    <span className={`${classes.syncStatus} ${classes.syncError}`} role="alert">
                      <ErrorOutline />
                      <span className={classes.statusText}>
                        Não foi possível consultar o Quark.
                      </span>
                      <Button
                        className={classes.retryButton}
                        size="small"
                        startIcon={<Refresh />}
                        onClick={() => setQuarkReload(value => value + 1)}
                      >
                        Tentar novamente
                      </Button>
                    </span>
                  )}
                </dd>
                {quarkPatient?.birthDate && (
                  <>
                    <dt>Nascimento</dt>
                    <dd>{quarkPatient.birthDate}</dd>
                  </>
                )}
              </dl>
              {quarkPatient && (
                <Button
                  className={classes.quarkLink}
                  color="primary"
                  size="small"
                  endIcon={<ArrowForward fontSize="small" />}
                  onClick={() =>
                    history.push(
                      buildQuarkPatientPath(quarkPatient.patientId, ticket?.id)
                    )
                  }
                >
                  Ver cadastro no Quark
                </Button>
              )}
              {quarkLoading && (
                <Typography className={classes.quarkSource}>
                  Consultando dados do Quark…
                </Typography>
              )}
            </Paper>
            {ticket && (
              <Paper variant="outlined" className={classes.card}>
                <Typography component="h3">Atendimento atual</Typography>
                <dl className={classes.details}>
                  <dt>Referência</dt>
                  <dd>#{ticket.id || "—"}</dd>
                  <dt>Canal</dt>
                  <dd>{ticket.whatsapp?.name || "WhatsApp"}</dd>
                  <dt>Setor</dt>
                  <dd>{ticket.queue?.name || "Sem setor"}</dd>
                  <dt>Responsável</dt>
                  <dd>{ticket.user?.name || "Aguardando atribuição"}</dd>
                </dl>
              </Paper>
            )}
            {context?.lastAppointment && (
              <Paper variant="outlined" className={classes.card}>
                <Typography component="h3">Última consulta</Typography>
                {renderAppointment(context.lastAppointment)}
              </Paper>
            )}
            {context && (
              <Paper variant="outlined" className={classes.card}>
                <Typography component="h3">Próximas consultas</Typography>
                {context.appointments?.length ? (
                  context.appointments.map(appointment =>
                    renderAppointment(appointment, true)
                  )
                ) : (
                  <Typography className={classes.empty}>
                    Nenhuma consulta futura vinculada a este número.
                  </Typography>
                )}
              </Paper>
            )}
            <Paper variant="outlined" className={classes.card}>
              <Typography component="h3">Informações adicionais</Typography>
              {!contact.extraInfo?.length && (
                <Typography className={classes.empty}>
                  Sem informações adicionais cadastradas.
                </Typography>
              )}
              {contact.extraInfo?.map((info) => (
                <div key={info.id} className={classes.extraInfo}>
                  <Typography variant="caption" color="textSecondary">
                    {info.name}
                  </Typography>
                  <MarkdownWrapper>{info.value}</MarkdownWrapper>
                </div>
              ))}
            </Paper>
            <ContactModal
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              contactId={contact.id}
            />
          </>
        )}
      </div>
      </Drawer>
      <Dialog
        open={Boolean(confirmation)}
        onClose={() => !confirmingAppointment && setConfirmation(null)}
        maxWidth="xs"
        fullWidth
        aria-labelledby="contact-drawer-confirm-title"
      >
        <DialogTitle id="contact-drawer-confirm-title">
          Confirmar consulta no Quark?
        </DialogTitle>
        <DialogContent dividers>
          <Typography paragraph>
            {appointmentDateTimeLabel(
              confirmation?.scheduledAt,
              context?.clinicTimezone
            )}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Esta ação altera a agenda. O estado da consulta será conferido
            novamente antes de confirmar.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={Boolean(confirmingAppointment)}
            onClick={() => setConfirmation(null)}
          >
            Voltar
          </Button>
          <Button
            color="primary"
            variant="contained"
            disabled={Boolean(confirmingAppointment)}
            onClick={() => confirmAppointment(confirmation)}
          >
            {confirmingAppointment ? "Confirmando…" : "Confirmar consulta"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
export default ContactDrawer;
