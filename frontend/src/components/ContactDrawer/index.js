import React, { useContext, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { makeStyles, Typography, IconButton, Drawer, Link, Button, Paper } from "@material-ui/core";
import { Close, EditOutlined, WhatsApp } from "@material-ui/icons";
import Skeleton from "@material-ui/lab/Skeleton";
import ContactModal from "../ContactModal";
import ContactAvatar from "../ContactAvatar";
import MarkdownWrapper from "../MarkdownWrapper";
import {
  appointmentDateTimeLabel,
  appointmentDayLabel,
  appointmentStatusLabel
} from "../../services/appointmentDisplay";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import {
  buildQuarkAppointmentPath,
  buildQuarkPatientPath
} from "../../services/quarkClinicNavigation";
const useStyles = makeStyles(theme => ({
  docked: {
    width: 272,
    flexShrink: 0,
    height: "100%"
  },
  drawerPaper: {
    width: 300,
    maxWidth: "100vw",
    height: "100%",
    overflow: "hidden",
    borderLeft: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper
  },
  dockedPaper: {
    position: "relative",
    width: 272
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px",
    minHeight: 44,
    "& h2": {
      fontSize: 11,
      fontWeight: 500,
      color: theme.palette.text.secondary
    }
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: "0 12px 16px",
    ...theme.scrollbarStyles
  },
  contactHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 0 16px"
  },
  avatar: {
    width: 52,
    height: 52,
    fontSize: 17
  },
  identity: {
    minWidth: 0,
    flex: 1,
    "& h3": {
      fontSize: 14,
      fontWeight: 600,
      overflowWrap: "anywhere"
    }
  },
  channel: {
    display: "flex",
    gap: 4,
    alignItems: "center",
    marginTop: 4,
    fontSize: 11,
    color: theme.palette.success.main,
    "& svg": {
      fontSize: 14
    }
  },
  editButton: {
    width: "100%",
    minHeight: 32,
    fontSize: 11
  },
  card: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    boxShadow: "none",
    "& h3": {
      fontSize: 12,
      fontWeight: 550,
      marginBottom: 12
    }
  },
  details: {
    display: "grid",
    gridTemplateColumns: "72px minmax(0, 1fr)",
    gap: "10px 8px",
    margin: 0,
    fontSize: 11,
    lineHeight: 1.5,
    "& dt": {
      color: theme.palette.text.secondary
    },
    "& dd": {
      margin: 0,
      overflowWrap: "anywhere"
    }
  },
  extraInfo: {
    padding: "8px 0",
    borderTop: `1px solid ${theme.palette.divider}`,
    fontSize: 12,
    overflowWrap: "anywhere"
  },
  appointmentHeading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
    fontSize: 12,
    fontWeight: 600
  },
  appointmentDay: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 22,
    padding: "2px 7px",
    borderRadius: 999,
    background: theme.modeTokens.surfaceTint,
    color: theme.palette.type === "dark" ? "#8EE3D6" : "#075E57",
    fontSize: 10,
    fontWeight: 700,
    whiteSpace: "nowrap"
  },
  appointmentMeta: {
    display: "block",
    marginTop: 4
  },
  appointmentFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  quarkButton: {
    minWidth: 0,
    padding: "2px 4px",
    fontSize: 10,
    fontWeight: 600,
    textTransform: "none"
  },
  empty: {
    fontSize: 11,
    lineHeight: 1.7,
    color: theme.palette.text.secondary
  },
  quarkSource: {
    display: "block",
    marginTop: 2,
    fontSize: 10,
    color: theme.palette.text.secondary
  },
  quarkLink: {
    marginTop: 10,
    padding: "3px 6px",
    fontSize: 10,
    textTransform: "none"
  }
}));
const ContactDrawer = ({
  open,
  docked = false,
  handleDrawerClose,
  contact,
  loading,
  ticket,
  context
}) => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const [modalOpen, setModalOpen] = useState(false);
  const [quarkPatient, setQuarkPatient] = useState(null);
  const [quarkLoading, setQuarkLoading] = useState(false);
  const [importedCpf, setImportedCpf] = useState("");

  useEffect(() => {
    let active = true;
    setQuarkPatient(null);
    setImportedCpf("");
    if (!open || !contact?.id || !user?.canAccessQuarkClinic) {
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
        setQuarkPatient(data);
        if (data.cpf && !contact.cpf) {
          api
            .put(`/contacts/${contact.id}`, { cpf: data.cpf })
            .then(() => {
              if (active) setImportedCpf(data.cpf);
            })
            .catch(() => undefined);
        }
      })
      .catch(() => {
        if (active) setQuarkPatient(null);
      })
      .finally(() => {
        if (active) setQuarkLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, contact?.id, contact?.cpf, user?.canAccessQuarkClinic]);

  const formatCpf = value => {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length !== 11) return value || "";
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
      6,
      9
    )}-${digits.slice(9)}`;
  };
  const renderAppointment = appointment => <div key={appointment.appointmentId} className={classes.extraInfo}>
      <div className={classes.appointmentHeading}>
        <span>{appointmentDateTimeLabel(appointment.scheduledAt, context?.clinicTimezone)}</span>
        <span className={classes.appointmentDay}>{appointmentDayLabel(appointment.scheduledAt, context?.serverNow, context?.clinicTimezone)}</span>
      </div>
      <div className={classes.appointmentFooter}>
        <Typography variant="caption" color="textSecondary" className={classes.appointmentMeta}>{appointmentStatusLabel(appointment.status)} · {appointment.reference}</Typography>
        <Button
          className={classes.quarkButton}
          color="primary"
          size="small"
          onClick={() => history.push(buildQuarkAppointmentPath(appointment.appointmentId, ticket?.id))}
        >
          Ver no Quark
        </Button>
      </div>
    </div>;
  return <Drawer className={docked && open ? classes.docked : undefined} variant={docked ? "persistent" : "temporary"} onClose={handleDrawerClose} anchor="right" open={open} classes={{
    paper: `${classes.drawerPaper} ${docked ? classes.dockedPaper : ""}`
  }} PaperProps={{
    component: "aside",
    "aria-label": "Detalhes do contato"
  }}>
      <div className={classes.header}>
        <Typography component="h2">Detalhes do contato</Typography>
        <IconButton size="small" aria-label="Fechar detalhes do contato" onClick={handleDrawerClose}><Close fontSize="small" /></IconButton>
      </div>
      <div className={classes.content}>
        {loading ? <><Skeleton variant="circle" width={52} height={52} /><Skeleton height={42} /><Skeleton variant="rect" height={180} /></> : <>
            <div className={classes.contactHeader}>
              <ContactAvatar contact={contact} className={classes.avatar} />
              <div className={classes.identity}>
                <Typography component="h3">{contact.name || "Contato"}</Typography>
                <div className={classes.channel}><WhatsApp /> WhatsApp</div>
              </div>
            </div>
            <Button className={classes.editButton} variant="outlined" startIcon={<EditOutlined />} onClick={() => setModalOpen(true)}>Editar contato</Button>
            <Paper variant="outlined" className={classes.card}>
              <Typography component="h3">Informações do contato</Typography>
              <dl className={classes.details}>
                <dt>Nome</dt><dd>{contact.name || "Não informado"}</dd>
                <dt>Telefone</dt><dd>{contact.number ? <Link href={`tel:${contact.number}`}>{contact.number}</Link> : "Não informado"}</dd>
                <dt>E-mail</dt><dd>{contact.email || "Não informado"}</dd>
                <dt>CPF</dt>
                <dd>
                  {formatCpf(contact.cpf || importedCpf || quarkPatient?.cpf) ||
                    "Não informado"}
                  {(importedCpf || quarkPatient?.cpf) && !contact.cpf && (
                    <Typography className={classes.quarkSource}>
                      Sincronizado do Quark
                    </Typography>
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
            {ticket && <Paper variant="outlined" className={classes.card}>
              <Typography component="h3">Atendimento atual</Typography>
              <dl className={classes.details}>
                <dt>Referência</dt><dd>#{ticket.id || "—"}</dd>
                <dt>Canal</dt><dd>{ticket.whatsapp?.name || "WhatsApp"}</dd>
                <dt>Setor</dt><dd>{ticket.queue?.name || "Sem setor"}</dd>
                <dt>Responsável</dt><dd>{ticket.user?.name || "Aguardando atribuição"}</dd>
              </dl>
            </Paper>}
            {context?.lastAppointment && <Paper variant="outlined" className={classes.card}>
              <Typography component="h3">Última consulta</Typography>
              {renderAppointment(context.lastAppointment)}
            </Paper>}
            {context && <Paper variant="outlined" className={classes.card}>
              <Typography component="h3">Próximas consultas</Typography>
              {context.appointments?.length ? context.appointments.map(renderAppointment) : <Typography className={classes.empty}>Nenhuma consulta futura vinculada a este número.</Typography>}
            </Paper>}
            <Paper variant="outlined" className={classes.card}>
              <Typography component="h3">Informações adicionais</Typography>
              {!contact.extraInfo?.length && <Typography className={classes.empty}>Sem informações adicionais cadastradas.</Typography>}
              {contact.extraInfo?.map(info => <div key={info.id} className={classes.extraInfo}>
                <Typography variant="caption" color="textSecondary">{info.name}</Typography>
                <MarkdownWrapper>{info.value}</MarkdownWrapper>
              </div>)}
            </Paper>
            <ContactModal open={modalOpen} onClose={() => setModalOpen(false)} contactId={contact.id} />
          </>}
      </div>
    </Drawer>;
};
export default ContactDrawer;
