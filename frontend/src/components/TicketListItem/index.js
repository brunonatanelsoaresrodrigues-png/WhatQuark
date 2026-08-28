import React, { useContext, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { Box, Button, ButtonBase, Chip, Typography, makeStyles } from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import ContactAvatar from "../ContactAvatar";
const useStyles = makeStyles(theme => ({
  "@keyframes arrive": {
    from: {
      opacity: 0,
      transform: "translateY(3px)"
    },
    to: {
      opacity: 1,
      transform: "translateY(0)"
    }
  },
  row: {
    animation: "$arrive 160ms ease-out",
    border: `1px solid ${theme.palette.divider}`,
    borderLeft: "2px solid transparent",
    padding: "8px 10px",
    marginBottom: 5,
    borderRadius: 8,
    background: theme.modeTokens.surfaceMuted,
    transition: "background-color 160ms ease, border-color 160ms ease",
    "&:hover": {
      background: theme.modeTokens.surfaceMuted
    }
  },
  selected: {
    borderLeftColor: theme.palette.primary.main,
    background: theme.modeTokens.surfaceRaised,
    borderColor: theme.palette.type === "dark" ? "#28546B" : "#AAD7D0",
    boxShadow: "none"
  },
  preview: {
    width: "100%",
    display: "flex",
    textAlign: "left",
    gap: 9,
    borderRadius: 10,
    padding: "1px 0",
    justifyContent: "flex-start"
  },
  text: {
    flex: 1,
    minWidth: 0
  },
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
    margin: "5px 0 0 47px"
  },
  chip: {
    height: 18,
    maxWidth: "100%",
    fontSize: 10,
    color: theme.palette.text.secondary,
    background: theme.modeTokens.surfaceMuted,
    borderColor: theme.palette.divider,
    borderRadius: 9,
    "& .MuiChip-label": {
      padding: "0 7px",
      fontWeight: 450
    }
  },
  unread: {
    minWidth: 18,
    height: 18,
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    padding: "1px 6px",
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontSize: 10,
    fontWeight: 600
  },
  lastMessage: {
    marginTop: 3,
    fontSize: ".72rem",
    lineHeight: 1.5
  },
  ticketTime: {
    fontSize: ".66rem"
  }
}));
export default function TicketListItem({
  ticket
}) {
  const classes = useStyles();
  const history = useHistory();
  const {
    ticketId
  } = useParams();
  const {
    user
  } = useContext(AuthContext);
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
  return <div className={`${classes.row} ${Number(ticketId) === ticket.id ? classes.selected : ""}`}>
      <ButtonBase className={classes.preview} onClick={() => history.push(`/tickets/${ticket.id}`)} aria-label={`Abrir atendimento de ${ticket.contact?.name}`}>
        <ContactAvatar contact={ticket.contact} />
        <div className={classes.text}>
          <div className={classes.top}>
            <Typography variant="body2" noWrap style={{
            fontWeight: 600,
            fontSize: ".79rem"
          }}>
              {ticket.contact?.name}
            </Typography>
            <Typography variant="caption" color="textSecondary" className={classes.ticketTime} style={{
            flexShrink: 0
          }}>
              {Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit"
            })}
            </Typography>
          </div>
          <Typography variant="body2" noWrap color="textSecondary" className={classes.lastMessage}>
            {ticket.lastMessage || "Nenhuma mensagem ainda"}
          </Typography>
        </div>
        {!!ticket.unreadMessages && <span className={classes.unread} aria-label={`${ticket.unreadMessages} mensagens não lidas`}>
            {ticket.unreadMessages}
          </span>}
      </ButtonBase>
      <div className={classes.meta}>
        <Chip className={classes.chip} variant="outlined" label={ticket.queue?.name || "Sem setor"} />
        {ticket.user?.name && <Typography variant="caption" color="textSecondary" noWrap style={{
        fontSize: 10,
        flex: 1
      }}>
            {ticket.user.name}
          </Typography>}
        {ticket.awaitingPatientSince && <Chip className={classes.chip} label="Aguardando paciente" />}
        {ticket.status === "closed" && <Chip className={classes.chip} label={ticket.closedByInactivity ? "Resolvido por inatividade" : "Resolvido"} />}
        {ticket.status === "pending" && <Box ml="auto">
            <Button size="small" color="primary" disabled={loading} onClick={accept}>
              {loading ? "Aceitando…" : "Aceitar"}
            </Button>
          </Box>}
      </div>
    </div>;
}
