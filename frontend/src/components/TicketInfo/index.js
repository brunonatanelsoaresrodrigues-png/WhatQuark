import React from "react";

import { Avatar, CardHeader } from "@material-ui/core";

import { i18n } from "../../translate/i18n";

const TicketInfo = ({ contact, ticket, onClick }) => {
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
      style={{ cursor: "pointer", padding: "8px 4px", minWidth: 0 }}
      titleTypographyProps={{
        noWrap: true,
        variant: "subtitle1",
        style: { fontWeight: 700 }
      }}
      subheaderTypographyProps={{ noWrap: true }}
      avatar={<Avatar src={contact.profilePicUrl} alt="" />}
      title={`${contact.name} #${ticket.id}`}
      subheader={
        ticket.user &&
        `${i18n.t("messagesList.header.assignedTo")} ${ticket.user.name}`
      }
    />
  );
};

export default TicketInfo;
