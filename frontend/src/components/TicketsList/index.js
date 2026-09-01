import React, { useState, useEffect, useReducer, useContext } from "react";
import openSocket from "../../services/socket-io";
import { makeStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import ErrorOutlineIcon from "@material-ui/icons/ErrorOutline";
import ForumOutlinedIcon from "@material-ui/icons/ForumOutlined";
import TicketListItem from "../TicketListItem";
import TicketsListSkeleton from "../TicketsListSkeleton";
import useTickets from "../../hooks/useTickets";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
const useStyles = makeStyles(theme => ({
  ticketsListWrapper: {
    position: "relative",
    display: "flex",
    height: "100%",
    flexDirection: "column",
    overflow: "hidden",
    minHeight: 0,
    borderRadius: 0
  },
  ticketsList: {
    flex: 1,
    overflowY: "auto",
    ...theme.scrollbarStyles,
    background: theme.palette.background.paper
  },
  noTicketsText: {
    textAlign: "center",
    color: theme.palette.text.secondary,
    maxWidth: 240,
    margin: theme.spacing(0.5, 0, 0),
    fontSize: theme.productTokens.typography.bodySM.fontSize,
    lineHeight: theme.productTokens.typography.bodySM.lineHeight
  },
  noTicketsTitle: {
    textAlign: "center",
    color: theme.palette.text.primary,
    fontSize: theme.productTokens.typography.body.fontSize,
    fontWeight: 650,
    margin: 0
  },
  noTicketsDiv: {
    display: "flex",
    minHeight: 220,
    margin: theme.spacing(2),
    padding: theme.spacing(3, 2),
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center"
  },
  emptyIcon: {
    display: "grid",
    width: 44,
    height: 44,
    marginBottom: theme.spacing(1.25),
    color: theme.statusTokens.info.fg,
    background: theme.statusTokens.info.bg,
    border: `1px solid ${theme.statusTokens.info.border}`,
    borderRadius: theme.productTokens.radii.md,
    placeItems: "center"
  },
  errorIcon: {
    color: theme.statusTokens.danger.fg,
    background: theme.statusTokens.danger.bg,
    borderColor: theme.statusTokens.danger.border
  },
  retry: {
    marginTop: theme.spacing(1.5)
  }
}));
const reducer = (state, action) => {
  if (action.type === "LOAD_TICKETS") {
    const newTickets = action.payload;
    newTickets.forEach(ticket => {
      const ticketIndex = state.findIndex(t => t.id === ticket.id);
      if (ticketIndex !== -1) {
        state[ticketIndex] = ticket;
        if (ticket.unreadMessages > 0) {
          state.unshift(state.splice(ticketIndex, 1)[0]);
        }
      } else {
        state.push(ticket);
      }
    });
    return [...state];
  }
  if (action.type === "RESET_UNREAD") {
    const ticketId = action.payload;
    const ticketIndex = state.findIndex(t => t.id === ticketId);
    if (ticketIndex !== -1) {
      state[ticketIndex].unreadMessages = 0;
    }
    return [...state];
  }
  if (action.type === "UPDATE_TICKET") {
    const ticket = action.payload;
    const ticketIndex = state.findIndex(t => t.id === ticket.id);
    if (ticketIndex !== -1) {
      state[ticketIndex] = ticket;
    } else {
      state.unshift(ticket);
    }
    return [...state];
  }
  if (action.type === "UPDATE_TICKET_UNREAD_MESSAGES") {
    const ticket = action.payload;
    const ticketIndex = state.findIndex(t => t.id === ticket.id);
    if (ticketIndex !== -1) {
      state[ticketIndex] = ticket;
      state.unshift(state.splice(ticketIndex, 1)[0]);
    } else {
      state.unshift(ticket);
    }
    return [...state];
  }
  if (action.type === "UPDATE_TICKET_CONTACT") {
    const contact = action.payload;
    const ticketIndex = state.findIndex(t => t.contactId === contact.id);
    if (ticketIndex !== -1) {
      state[ticketIndex].contact = contact;
    }
    return [...state];
  }
  if (action.type === "DELETE_TICKET") {
    const ticketId = action.payload;
    const ticketIndex = state.findIndex(t => t.id === ticketId);
    if (ticketIndex !== -1) {
      state.splice(ticketIndex, 1);
    }
    return [...state];
  }
  if (action.type === "RESET") {
    return [];
  }
};
const TicketsList = props => {
  const {
    status,
    searchParam,
    showAll,
    assignee,
    date,
    withUnreadMessages,
    selectedQueueIds,
    updateCount,
    style,
    notifyOnError = true
  } = props;
  const classes = useStyles();
  const [pageNumber, setPageNumber] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [ticketsList, dispatch] = useReducer(reducer, []);
  const {
    user
  } = useContext(AuthContext);
  useEffect(() => {
    dispatch({
      type: "RESET"
    });
    setPageNumber(1);
  }, [status, searchParam, dispatch, showAll, assignee, selectedQueueIds, date, withUnreadMessages]);
  const {
    tickets,
    hasMore,
    loading,
    count,
    error
  } = useTickets({
    pageNumber,
    searchParam,
    status,
    showAll,
    assignee,
    date,
    withUnreadMessages,
    refreshKey,
    queueIds: JSON.stringify(selectedQueueIds),
    notifyOnError
  });
  useEffect(() => {
    dispatch({
      type: "LOAD_TICKETS",
      payload: tickets
    });
  }, [tickets, status, searchParam]);
  useEffect(() => {
    const socket = openSocket();
    let refreshTimer;
    const refreshTotals = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => setRefreshKey(value => value + 1), 400);
    };
    const matchesAssignee = ticket => assignee === "all" ? true : assignee === "unassigned" ? !ticket.userId : assignee === "me" ? ticket.userId === user?.id : assignee?.startsWith("user:") ? ticket.userId === Number(assignee.slice(5)) : !ticket.userId || ticket.userId === user?.id || showAll;
    const shouldUpdateTicket = ticket => !searchParam && matchesAssignee(ticket) && (!status || ticket.status === status) && (!ticket.userId || ticket.userId === user?.id || showAll) && (!ticket.queueId || selectedQueueIds.indexOf(ticket.queueId) > -1) && (withUnreadMessages !== "true" || ticket.unreadMessages > 0) && (!date || new Date(ticket.createdAt).toLocaleDateString("en-CA") === date);
    const notBelongsToUserQueues = ticket => ticket.queueId && selectedQueueIds.indexOf(ticket.queueId) === -1;
    socket.on("connect", () => {
      if (status) {
        socket.emit("joinTickets", status);
      } else {
        socket.emit("joinNotification");
      }
    });
    socket.on("ticket", data => {
      refreshTotals();
      if (data.action === "updateUnread") {
        dispatch({
          type: withUnreadMessages === "true" ? "DELETE_TICKET" : "RESET_UNREAD",
          payload: data.ticketId
        });
      }
      if (data.action === "update" && shouldUpdateTicket(data.ticket)) {
        dispatch({
          type: "UPDATE_TICKET",
          payload: data.ticket
        });
      }
      if (data.action === "update" && (!matchesAssignee(data.ticket) || status && data.ticket.status !== status || notBelongsToUserQueues(data.ticket) || withUnreadMessages === "true" && !data.ticket.unreadMessages)) {
        dispatch({
          type: "DELETE_TICKET",
          payload: data.ticket.id
        });
      }
      if (data.action === "delete") {
        dispatch({
          type: "DELETE_TICKET",
          payload: data.ticketId
        });
      }
    });
    socket.on("appMessage", data => {
      refreshTotals();
      if (data.action === "create" && shouldUpdateTicket(data.ticket)) {
        dispatch({
          type: "UPDATE_TICKET_UNREAD_MESSAGES",
          payload: data.ticket
        });
      }
    });
    socket.on("contact", data => {
      if (data.action === "update") {
        dispatch({
          type: "UPDATE_TICKET_CONTACT",
          payload: data.contact
        });
      }
    });
    return () => {
      clearTimeout(refreshTimer);
      socket.disconnect();
    };
  }, [status, searchParam, showAll, assignee, user, selectedQueueIds, date, withUnreadMessages]);
  useEffect(() => {
    if (typeof updateCount === "function") {
      if (!loading) updateCount(error ? null : count);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, loading, error]);
  const loadMore = () => {
    setPageNumber(prevState => prevState + 1);
  };
  const handleScroll = e => {
    if (!hasMore || loading) return;
    const {
      scrollTop,
      scrollHeight,
      clientHeight
    } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      e.currentTarget.scrollTop = scrollTop - 100;
      loadMore();
    }
  };
  return <Paper className={classes.ticketsListWrapper} style={style}>
      <Paper square name="closed" elevation={0} className={classes.ticketsList} onScroll={handleScroll}>
        <List component="div" style={{
        padding: 6
      }}>
          {error && <div role="alert" className={classes.noTicketsDiv}>
              <span className={`${classes.emptyIcon} ${classes.errorIcon}`} aria-hidden="true">
                <ErrorOutlineIcon />
              </span>
              <span className={classes.noTicketsTitle}>A fila não pôde ser atualizada</span>
              <p className={classes.noTicketsText}>
                Confira sua conexão e tente novamente para carregar as conversas.
              </p>
              <Button className={classes.retry} color="primary" variant="outlined" onClick={() => setRefreshKey(value => value + 1)}>
                Tentar novamente
              </Button>
            </div>}
          {ticketsList.length === 0 && !loading && !error ? <div role="status" className={classes.noTicketsDiv}>
              <span className={classes.emptyIcon} aria-hidden="true">
                <ForumOutlinedIcon />
              </span>
              <span className={classes.noTicketsTitle}>
                {i18n.t("ticketsList.noTicketsTitle")}
              </span>
              <p className={classes.noTicketsText}>
                {i18n.t("ticketsList.noTicketsMessage")}
              </p>
            </div> : <>
              {ticketsList.map(ticket => <TicketListItem ticket={ticket} key={ticket.id} />)}
            </>}
          {loading && <TicketsListSkeleton />}
        </List>
      </Paper>
    </Paper>;
};
export default TicketsList;
