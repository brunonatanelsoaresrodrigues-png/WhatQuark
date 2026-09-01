import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { makeStyles } from "@material-ui/core";
import TicketsManager from "../../components/TicketsManager";
import Ticket from "../../components/Ticket";
import ConversationWelcome from "../../components/ConversationWelcome";

const useStyles = makeStyles(theme => ({
  root: {
    flex: 1,
    display: "flex",
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
    gap: theme.spacing(1),
    padding: "0 10px 10px",
    background: theme.palette.background.default,
    [theme.breakpoints.down("sm")]: { gap: 0, padding: 0 }
  },
  list: {
    width: 310,
    minWidth: 280,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    overflow: "hidden",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.productTokens.radii.sm,
    [theme.breakpoints.down("md")]: { width: 328, minWidth: 316 },
    [theme.breakpoints.up("xl")]: { width: 340 },
    [theme.breakpoints.down("sm")]: {
      width: "100%",
      minWidth: 0,
      border: 0,
      borderRadius: 0
    }
  },
  hiddenList: { [theme.breakpoints.down("sm")]: { display: "none" } },
  conversation: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.productTokens.radii.sm,
    [theme.breakpoints.down("sm")]: { border: 0, borderRadius: 0 }
  },
  hiddenConversation: { [theme.breakpoints.down("sm")]: { display: "none" } }
}));

export default function Tickets() {
  const classes = useStyles();
  const { ticketId } = useParams();
  const [status, setStatus] = useState("open");
  const [counts, setCounts] = useState({
    open: null,
    pending: null,
    closed: null
  });
  return (
    <div className={classes.root}>
      <aside
        aria-label="Lista de atendimentos"
        className={`${classes.list} ${ticketId ? classes.hiddenList : ""}`}
      >
        <TicketsManager
          status={status}
          onStatusChange={setStatus}
          onCountsChange={setCounts}
        />
      </aside>
      <section
        aria-label="Conversa"
        className={`${classes.conversation} ${
          !ticketId ? classes.hiddenConversation : ""
        }`}
      >
        {ticketId ? (
          <Ticket />
        ) : (
          <ConversationWelcome
            counts={counts}
            onViewQueue={() => setStatus("pending")}
          />
        )}
      </section>
    </div>
  );
}
