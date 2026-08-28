import React from "react";
import { Avatar, CardHeader, makeStyles } from "@material-ui/core";

import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
  root: {
    minWidth: 0,
    padding: "6px 4px",
    cursor: "pointer",
    borderRadius: 10,
    transition: "background-color 160ms ease",
    "&:hover": { background: theme.modeTokens.surfaceMuted }
  },
  avatar: {
    width: 42,
    height: 42,
    color: "#fff",
    fontWeight: 750,
    background: "linear-gradient(145deg, #0c7c72, #3978e6)"
  },
  title: { fontWeight: 750 },
  subheader: { fontSize: ".72rem" }
}));

const TicketInfo = ({ contact, ticket, onClick }) => {
  const classes = useStyles();
  const assignedLabel = ticket.user
    ? `${i18n.t("messagesList.header.assignedTo")} ${ticket.user.name}`
    : "Aguardando responsável";

  return (
    <CardHeader
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label="Ver detalhes do contato"
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={classes.root}
      titleTypographyProps={{
        noWrap: true,
        variant: "subtitle1",
        className: classes.title
      }}
      subheaderTypographyProps={{ noWrap: true, className: classes.subheader }}
      avatar={
        <Avatar className={classes.avatar} src={contact.profilePicUrl} alt="">
          {contact.name?.charAt(0)}
        </Avatar>
      }
      title={`${contact.name || "Contato"} · #${ticket.id || "—"}`}
      subheader={assignedLabel}
    />
  );
};

export default TicketInfo;
