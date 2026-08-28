import React from "react";
import { useParams } from "react-router-dom";
import { makeStyles, Paper, Typography } from "@material-ui/core";
import ChatBubbleOutline from "@material-ui/icons/ChatBubbleOutline";
import TicketsManager from "../../components/TicketsManager";
import Ticket from "../../components/Ticket";
const useStyles = makeStyles(theme => ({
  root: {
    flex: 1,
    display: "flex",
    minHeight: 0,
    minWidth: 0,
    height: "100%",
    overflow: "hidden",
    background: theme.palette.background.paper
  },
  list: {
    width: 330,
    minWidth: 290,
    flexShrink: 0,
    borderRight: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    [theme.breakpoints.down("sm")]: { width: "100%", minWidth: 0 }
  },
  hiddenList: { [theme.breakpoints.down("sm")]: { display: "none" } },
  conversation: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    height: "100%"
  },
  hiddenConversation: { [theme.breakpoints.down("sm")]: { display: "none" } },
  empty: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    padding: 32,
    gap: 16,
    textAlign: "center",
    background: theme.palette.background.default
  }
}));
export default function Tickets() {
  const classes = useStyles();
  const { ticketId } = useParams();
  return (
    <div className={classes.root}>
      <aside
        aria-label="Lista de atendimentos"
        className={`${classes.list} ${ticketId ? classes.hiddenList : ""}`}
      >
        <TicketsManager />
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
          <Paper square elevation={0} className={classes.empty}>
            <ChatBubbleOutline color="primary" style={{ fontSize: 48 }} />
            <Typography variant="h5">Pronto para atender</Typography>
            <Typography color="textSecondary">
              Selecione uma conversa para consultar o histórico e continuar o
              atendimento.
            </Typography>
          </Paper>
        )}
      </section>
    </div>
  );
}
