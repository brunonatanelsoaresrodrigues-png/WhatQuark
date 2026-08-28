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
  row: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    borderLeft: "3px solid transparent",
    padding: "10px 12px",
    "&:hover": { background: theme.palette.action.hover }
  },
  selected: {
    borderLeftColor: theme.palette.primary.main,
    background: theme.palette.action.selected
  },
  preview: {
    width: "100%",
    display: "flex",
    textAlign: "left",
    gap: 10,
    borderRadius: 6,
    padding: "4px 0",
    justifyContent: "flex-start"
  },
  text: { flex: 1, minWidth: 0 },
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
    margin: "8px 0 0 50px"
  },
  chip: { fontSize: 11, height: 22, maxWidth: "100%" },
  unread: {
    borderRadius: 12,
    padding: "1px 6px",
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontSize: 11
  }
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
        <Avatar src={ticket.contact?.profilePicUrl} alt="">
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
          <Typography variant="body2" noWrap color="textSecondary">
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
