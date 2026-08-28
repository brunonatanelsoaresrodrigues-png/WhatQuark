import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useHistory } from "react-router-dom";

import { toast } from "react-toastify";
import openSocket from "../../services/socket-io";
import clsx from "clsx";

import { Paper, makeStyles } from "@material-ui/core";

import ContactDrawer from "../ContactDrawer";
import MessageInput from "../MessageInput/";
import TicketContext from "../TicketContext";
import TicketHeader from "../TicketHeader";
import TicketInfo from "../TicketInfo";
import TicketActionButtons from "../TicketActionButtons";
import MessagesList from "../MessagesList";
import api from "../../services/api";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import toastError from "../../errors/toastError";

const drawerWidth = 320;

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    height: "100%",
    position: "relative",
    overflow: "hidden"
  },

  ticketInfo: { flex: "1 1 180px", minWidth: 0 },
  ticketActionButtons: {
    display: "flex",
    flex: "0 1 auto",
    minWidth: 0,
    marginLeft: "auto"
  },
  mainWrapper: {
    flex: 1,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeft: "0",
    marginRight: 0,
    minWidth: 0,
    minHeight: 0,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen
    })
  },

  mainWrapperShift: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen
    }),
    marginRight: 0
  }
}));

const Ticket = () => {
  const { ticketId } = useParams();
  const history = useHistory();
  const classes = useStyles();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({});
  const [ticket, setTicket] = useState({});
  const [context, setContext] = useState(null);
  const contextGeneration = useRef(0);
  const loadContext = useCallback(async () => {
    const generation = ++contextGeneration.current;
    try {
      const { data } = await api.get(`/tickets/${ticketId}/context`);
      if (generation === contextGeneration.current) setContext(data);
    } catch {
      if (generation === contextGeneration.current) setContext(null);
    }
  }, [ticketId]);
  useEffect(() => {
    setContext(null);
    loadContext();
    const timer = setInterval(loadContext, 30000);
    return () => {
      contextGeneration.current += 1;
      clearInterval(timer);
    };
  }, [loadContext, ticket.userId, ticket.status]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchTicket = async () => {
        try {
          const { data } = await api.get("/tickets/" + ticketId);

          if (!active) return;
          setContact(data.contact);
          setTicket(data);
          setLoading(false);
        } catch (err) {
          if (!active) return;
          setLoading(false);
          toastError(err);
        }
      };
      fetchTicket();
    }, 0);
    return () => {
      active = false;
      clearTimeout(delayDebounceFn);
    };
  }, [ticketId, history]);

  useEffect(() => {
    const socket = openSocket();

    socket.on("connect", () => socket.emit("joinChatBox", ticketId));

    socket.on("ticket", data => {
      if (Number(data.ticket?.id || data.ticketId) !== Number(ticketId)) return;
      if (data.action === "update") {
        setTicket(data.ticket);
      }

      if (data.action === "delete") {
        toast.success("Atendimento excluído.");
        history.push("/tickets");
      }
    });

    socket.on("ticketAccessDenied", () => history.push("/tickets"));

    socket.on("contact", data => {
      if (data.action === "update") {
        setContact(prevState => {
          if (prevState.id === data.contact?.id) {
            return { ...prevState, ...data.contact };
          }
          return prevState;
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [ticketId, history]);

  const handleDrawerOpen = () => {
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  return (
    <div className={classes.root} id="drawer-container">
      <Paper
        variant="outlined"
        elevation={0}
        className={clsx(classes.mainWrapper, {
          [classes.mainWrapperShift]: drawerOpen
        })}
      >
        <TicketHeader loading={loading}>
          <div className={classes.ticketInfo}>
            <TicketInfo
              contact={contact}
              ticket={ticket}
              onClick={handleDrawerOpen}
            />
          </div>
          <div className={classes.ticketActionButtons}>
            <TicketActionButtons ticket={ticket} context={context} />
          </div>
        </TicketHeader>
        <TicketContext
          ticket={ticket}
          context={context}
          onRefresh={loadContext}
        />
        <ReplyMessageProvider>
          <MessagesList
            ticketId={ticketId}
            isGroup={ticket.isGroup}
          ></MessagesList>
          <MessageInput
            key={ticketId}
            ticketStatus={ticket.status}
            sendBlocked={
              !context ||
              context.paused ||
              ["off", "simulation"].includes(context.mode) ||
              (context.official && !context.serviceWindowOpen)
            }
          />
        </ReplyMessageProvider>
      </Paper>
      <ContactDrawer
        open={drawerOpen}
        handleDrawerClose={handleDrawerClose}
        contact={contact}
        loading={loading}
      />
    </div>
  );
};

export default Ticket;
