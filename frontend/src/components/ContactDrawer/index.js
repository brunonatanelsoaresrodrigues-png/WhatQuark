import React, { useState } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import Drawer from "@material-ui/core/Drawer";
import Link from "@material-ui/core/Link";
import InputLabel from "@material-ui/core/InputLabel";
import Avatar from "@material-ui/core/Avatar";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";

import { i18n } from "../../translate/i18n";

import ContactModal from "../ContactModal";
import ContactDrawerSkeleton from "../ContactDrawerSkeleton";
import MarkdownWrapper from "../MarkdownWrapper";

const drawerWidth = 376;

const useStyles = makeStyles(theme => ({
  drawer: {
    width: drawerWidth,
    flexShrink: 0
  },
  drawerPaper: {
    width: drawerWidth,
    display: "flex",
    maxWidth: "100vw",
    borderLeft: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper
  },
  header: {
    display: "flex",
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.default,
    alignItems: "center",
    padding: theme.spacing(0, 1),
    minHeight: "73px",
    justifyContent: "flex-start"
  },
  content: {
    display: "flex",
    backgroundColor: theme.palette.background.default,
    flexDirection: "column",
    padding: 16,
    height: "100%",
    overflowY: "scroll",
    ...theme.scrollbarStyles
  },

  contactAvatar: {
    margin: 15,
    width: 80,
    height: 80,
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText
  },

  contactHeader: {
    display: "flex",
    padding: 20,
    borderRadius: 14,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    "& > *": {
      margin: 4
    }
  },

  contactDetails: {
    marginTop: 16,
    padding: 20,
    borderRadius: 14,
    display: "flex",
    flexDirection: "column"
  },
  contactExtraInfo: {
    marginTop: 4,
    padding: 12,
    background: theme.modeTokens.surfaceMuted,
    border: 0,
    borderRadius: 10
  }
}));

const ContactDrawer = ({
  open,
  handleDrawerClose,
  contact,
  loading,
  ticket,
  context
}) => {
  const classes = useStyles();

  const [modalOpen, setModalOpen] = useState(false);

  return (
    <Drawer
      className={classes.drawer}
      variant="temporary"
      onClose={handleDrawerClose}
      anchor="right"
      open={open}
      classes={{
        paper: classes.drawerPaper
      }}
    >
      <div className={classes.header}>
        <IconButton
          aria-label="Fechar detalhes do contato"
          onClick={handleDrawerClose}
        >
          <CloseIcon />
        </IconButton>
        <Typography style={{ justifySelf: "center" }}>
          {i18n.t("contactDrawer.header")}
        </Typography>
      </div>
      {loading ? (
        <ContactDrawerSkeleton classes={classes} />
      ) : (
        <div className={classes.content}>
          <Paper square variant="outlined" className={classes.contactHeader}>
            <Avatar
              alt={contact.name}
              src={contact.profilePicUrl}
              className={classes.contactAvatar}
            >
              {contact.name?.charAt(0)}
            </Avatar>

            <Typography variant="h6">{contact.name}</Typography>
            <Typography>
              <Link href={`tel:${contact.number}`}>{contact.number}</Link>
            </Typography>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setModalOpen(true)}
            >
              {i18n.t("contactDrawer.buttons.edit")}
            </Button>
          </Paper>
          {ticket && (
            <Paper variant="outlined" className={classes.contactDetails}>
              <Typography variant="subtitle1">Atendimento atual</Typography>
              <Typography variant="body2" color="textSecondary">
                Canal · {ticket.whatsapp?.name || "WhatsApp"}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Setor · {ticket.queue?.name || "Sem setor"}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Responsável · {ticket.user?.name || "Aguardando atribuição"}
              </Typography>
            </Paper>
          )}
          {context && (
            <Paper variant="outlined" className={classes.contactDetails}>
              <Typography variant="subtitle1">Próximas consultas</Typography>
              {context.appointments?.length ? (
                context.appointments.map(appointment => (
                  <div
                    key={appointment.appointmentId}
                    className={classes.contactExtraInfo}
                  >
                    <Typography variant="body2">
                      {new Date(appointment.scheduledAt).toLocaleString(
                        "pt-BR"
                      )}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {appointment.status} · {appointment.reference}
                    </Typography>
                  </div>
                ))
              ) : (
                <Typography variant="body2" color="textSecondary">
                  Nenhuma consulta futura vinculada a este número.
                </Typography>
              )}
            </Paper>
          )}
          <Paper square variant="outlined" className={classes.contactDetails}>
            <ContactModal
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              contactId={contact.id}
            ></ContactModal>
            <Typography variant="subtitle1">
              {i18n.t("contactDrawer.extraInfo")}
            </Typography>
            {!contact?.extraInfo?.length && (
              <Typography variant="body2" color="textSecondary">
                Sem informações adicionais cadastradas.
              </Typography>
            )}
            {contact?.extraInfo?.map(info => (
              <Paper
                key={info.id}
                square
                variant="outlined"
                className={classes.contactExtraInfo}
              >
                <InputLabel>{info.name}</InputLabel>
                <Typography
                  component="div"
                  style={{ paddingTop: 2, overflowWrap: "anywhere" }}
                >
                  <MarkdownWrapper>{info.value}</MarkdownWrapper>
                </Typography>
              </Paper>
            ))}
          </Paper>
        </div>
      )}
    </Drawer>
  );
};

export default ContactDrawer;
