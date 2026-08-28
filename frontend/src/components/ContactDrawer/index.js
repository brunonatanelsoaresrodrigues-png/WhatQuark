import React, { useState } from "react";
import { makeStyles, Typography, IconButton, Drawer, Link, Button, Paper } from "@material-ui/core";
import { Close, EditOutlined, WhatsApp } from "@material-ui/icons";
import Skeleton from "@material-ui/lab/Skeleton";
import ContactModal from "../ContactModal";
import ContactAvatar from "../ContactAvatar";
import MarkdownWrapper from "../MarkdownWrapper";
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
  empty: {
    fontSize: 11,
    lineHeight: 1.7,
    color: theme.palette.text.secondary
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
  const [modalOpen, setModalOpen] = useState(false);
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
              </dl>
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
            {context && <Paper variant="outlined" className={classes.card}>
              <Typography component="h3">Próximas consultas</Typography>
              {context.appointments?.length ? context.appointments.map(appointment => <div key={appointment.appointmentId} className={classes.extraInfo}>
                  <div>{new Date(appointment.scheduledAt).toLocaleString("pt-BR")}</div>
                  <Typography variant="caption" color="textSecondary">{appointment.status} · {appointment.reference}</Typography>
                </div>) : <Typography className={classes.empty}>Nenhuma consulta futura vinculada a este número.</Typography>}
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
