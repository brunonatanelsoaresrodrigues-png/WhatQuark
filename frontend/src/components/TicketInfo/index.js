import React from "react";
import { CardHeader, makeStyles } from "@material-ui/core";
import ContactAvatar from "../ContactAvatar";
import { i18n } from "../../translate/i18n";
const useStyles = makeStyles(theme => ({
  root: {
    minWidth: 0,
    padding: "6px 4px",
    cursor: "pointer",
    borderRadius: 10,
    transition: "background-color 160ms ease",
    "&:hover": {
      background: theme.modeTokens.surfaceMuted
    }
  },
  title: {
    fontWeight: 600,
    fontSize: ".8rem"
  },
  subheader: {
    fontSize: ".65rem"
  }
}));
const TicketInfo = ({
  contact,
  ticket,
  onClick
}) => {
  const classes = useStyles();
  const assignedLabel = ticket.user ? `${i18n.t("messagesList.header.assignedTo")} ${ticket.user.name}` : "Aguardando responsável";
  return <CardHeader onClick={onClick} role="button" tabIndex={0} aria-label="Ver detalhes do contato" onKeyDown={event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  }} className={classes.root} titleTypographyProps={{
    noWrap: true,
    variant: "subtitle1",
    className: classes.title
  }} subheaderTypographyProps={{
    noWrap: true,
    className: classes.subheader
  }} avatar={<ContactAvatar contact={contact} />} title={`${contact.name || "Contato"} · #${ticket.id || "—"}`} subheader={assignedLabel} />;
};
export default TicketInfo;
