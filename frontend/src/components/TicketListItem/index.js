import React, { useContext, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import {
  Avatar,
  Box,
  Button,
  ButtonBase,
  Chip,
  Typography,
  makeStyles
} from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import toastError from "../../errors/toastError";
const useStyles = makeStyles(theme => ({
  "@keyframes arrive": {
    from: { opacity: 0, transform: "translateY(3px)" },
    to: { opacity: 1, transform: "translateY(0)" }
  },
  row: {
    animation: "$arrive 160ms ease-out",
    border: "1px solid transparent",
    borderLeft: "3px solid transparent",
    padding: "11px 13px 10px",
    marginBottom: 4,
    borderRadius: 12,
    background: theme.palette.background.paper,
    transition: "background-color 160ms ease, border-color 160ms ease",
    "&:hover": { background: theme.modeTokens.surfaceMuted }
  },
  selected: {
    borderLeftColor: theme.palette.primary.main,
    background: theme.modeTokens.surfaceTint,
    boxShadow: "0 2px 8px rgba(12,124,114,.06)"
  },
  preview: {
    width: "100%",
    display: "flex",
    textAlign: "left",
    gap: 11,
    borderRadius: 10,
    padding: "4px 0",
    justifyContent: "flex-start"
  },
  text: { flex: 1, minWidth: 0 },
  avatar: {
    width: 44,
    height: 44,
    flexShrink: 0,
    fontWeight: 750,
    color: "#fff",
    background: "linear-gradient(145deg, #0c7c72, #3978e6)"
  },
  top: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between"
  },
  meta: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    margin: "8px 0 0 55px"
  },
  chip: {
    height: 22,
    maxWidth: "100%",
    fontSize: 10,
    color: theme.palette.text.secondary,
    background: theme.modeTokens.surfaceMuted,
    borderColor: theme.palette.divider
  },
  unread: {
    minWidth: 20,
    height: 20,
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    padding: "1px 6px",
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontSize: 10,
    fontWeight: 800,
    boxShadow: "0 4px 10px rgba(12,124,114,.2)"
  },
  lastMessage: { marginTop: 3, fontSize: ".78rem" },
  ticketTime: { fontSize: ".66rem" }
}));
export default function TicketListItem({ ticket }) {
  const classes = useStyles();
  const history = useHistory();
  const { ticketId } = useParams();
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const accept = async () => {
    setLoading(true);
    try {
      await api.put(`/tickets/${ticket.id}`, {
        status: "open",
        userId: user.id
      });
      history.push(`/tickets/${ticket.id}`);
    } catch (e) {
      toastError(e);
    } finally {
      setLoading(false);
    }
  };
  const date = new Date(ticket.updatedAt);
  return (
    <div
      className={`${classes.row} ${
        Number(ticketId) === ticket.id ? classes.selected : ""
      }`}
    >
      <ButtonBase
        className={classes.preview}
        onClick={() => history.push(`/tickets/${ticket.id}`)}
        aria-label={`Abrir atendimento de ${ticket.contact?.name}`}
      >
        <Avatar
          className={classes.avatar}
          src={ticket.contact?.profilePicUrl}
          alt=""
        >
          {ticket.contact?.name?.charAt(0)}
        </Avatar>
        <div className={classes.text}>
          <div className={classes.top}>
            <Typography variant="body2" noWrap style={{ fontWeight: 700 }}>
              {ticket.contact?.name}
            </Typography>
            <Typography
              variant="caption"
              color="textSecondary"
              className={classes.ticketTime}
              style={{ flexShrink: 0 }}
            >
              {Number.isNaN(date.getTime())
                ? ""
                : date.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
            </Typography>
          </div>
          <Typography
            variant="body2"
            noWrap
            color="textSecondary"
            className={classes.lastMessage}
          >
            {ticket.lastMessage || "Nenhuma mensagem ainda"}
          </Typography>
        </div>
        {!!ticket.unreadMessages && (
          <span
            className={classes.unread}
            aria-label={`${ticket.unreadMessages} mensagens não lidas`}
          >
            {ticket.unreadMessages}
          </span>
        )}
      </ButtonBase>
      <div className={classes.meta}>
        <Chip
          className={classes.chip}
          variant="outlined"
          label={ticket.queue?.name || "Sem setor"}
        />
        {ticket.user?.name && (
          <Typography variant="caption" color="textSecondary">
            {ticket.user.name}
          </Typography>
        )}
        {ticket.awaitingPatientSince && (
          <Chip className={classes.chip} label="Aguardando paciente" />
        )}
        {ticket.status === "closed" && (
          <Chip
            className={classes.chip}
            label={
              ticket.closedByInactivity
                ? "Resolvido por inatividade"
                : "Resolvido"
            }
          />
        )}
        {ticket.status === "pending" && (
          <Box ml="auto">
            <Button
              size="small"
              color="primary"
              disabled={loading}
              onClick={accept}
            >
              {loading ? "Aceitando…" : "Aceitar"}
            </Button>
          </Box>
        )}
      </div>
    </div>
  );
}
