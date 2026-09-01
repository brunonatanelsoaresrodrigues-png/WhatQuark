import React, { useContext, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { Box, Button, ButtonBase, Chip, Typography, makeStyles } from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import ContactAvatar from "../ContactAvatar";
import { contactDisplayName } from "../../services/contactIdentity";
const useStyles = makeStyles(theme => ({
  row: {
    animation: theme.productTokens.animations.arrive,
    border: `1px solid ${theme.palette.divider}`,
    borderLeft: "2px solid transparent",
    padding: "8px 10px",
    marginBottom: 5,
    borderRadius: theme.productTokens.radii.xs,
    background: theme.modeTokens.surfaceMuted,
    boxShadow: theme.productTokens.shadows.rest,
    transition: `transform ${theme.productTokens.motion.duration.micro}ms ${theme.productTokens.motion.easing}, background-color ${theme.productTokens.motion.duration.micro}ms ${theme.productTokens.motion.easing}, border-color ${theme.productTokens.motion.duration.micro}ms ${theme.productTokens.motion.easing}, box-shadow ${theme.productTokens.motion.duration.micro}ms ${theme.productTokens.motion.easing}`,
    // A linha sobe em direcao a cor do painel no hover, em vez de escurecer.
    "&:hover": {
      transform: "translateY(-1px)",
      background: theme.modeTokens.surface,
      borderColor: theme.modeTokens.borderStrong,
      boxShadow: theme.productTokens.shadows.soft
    }
  },
  unreadRow: {
    background: theme.modeTokens.surfaceRaised,
    "& $lastMessage": {
      color: theme.palette.text.primary,
      fontWeight: 500
    }
  },
  waitingRow: {
    borderLeftColor: theme.statusTokens.warning.border
  },
  resolvedRow: {
    borderLeftColor: theme.statusTokens.success.border,
    opacity: 0.88
  },
  selected: {
    borderLeftColor: theme.palette.primary.main,
    background: theme.modeTokens.surfaceTint,
    borderColor: theme.modeTokens.borderStrong,
    boxShadow: theme.productTokens.shadows.soft,
    "&:hover": {
      background: theme.modeTokens.surfaceTint
    }
  },
  preview: {
    width: "100%",
    display: "flex",
    textAlign: "left",
    gap: 9,
    borderRadius: theme.productTokens.radii.sm,
    padding: "1px 0",
    justifyContent: "flex-start"
  },
  text: {
    flex: 1,
    minWidth: 0
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
    fontSize: 12,
    color: theme.palette.text.secondary,
    background: theme.modeTokens.surfaceMuted,
    borderColor: theme.palette.divider,
    borderRadius: theme.productTokens.radii.pill,
    "& .MuiChip-label": {
      padding: "0 7px",
      fontWeight: 450
    }
  },
  chipWarning: {
    color: theme.statusTokens.warning.fg,
    background: theme.statusTokens.warning.bg,
    borderColor: theme.statusTokens.warning.border
  },
  chipSuccess: {
    color: theme.statusTokens.success.fg,
    background: theme.statusTokens.success.bg,
    borderColor: theme.statusTokens.success.border
  },
  chipInfo: {
    color: theme.statusTokens.info.fg,
    background: theme.statusTokens.info.bg,
    borderColor: theme.statusTokens.info.border
  },
  unread: {
    minWidth: 18,
    height: 18,
    display: "grid",
    placeItems: "center",
    borderRadius: theme.productTokens.radii.pill,
    padding: "1px 6px",
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontSize: 12,
    fontWeight: 600
  },
  lastMessage: {
    marginTop: 3,
    fontSize: ".75rem",
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
  const selected = Number(ticketId) === ticket.id;
  const contactName = contactDisplayName(ticket.contact);
  const rowStates = [
    classes.row,
    ticket.unreadMessages ? classes.unreadRow : "",
    ticket.status === "pending" ? classes.waitingRow : "",
    ticket.status === "closed" ? classes.resolvedRow : "",
    selected ? classes.selected : ""
  ].filter(Boolean).join(" ");
  return <div className={rowStates}>
      <ButtonBase className={classes.preview} onClick={() => history.push(`/tickets/${ticket.id}`)} aria-label={`Abrir atendimento de ${contactName}`} aria-current={selected ? "true" : undefined}>
        <ContactAvatar contact={ticket.contact} />
        <div className={classes.text}>
          <div className={classes.top}>
            <Typography variant="body2" noWrap style={{
            fontWeight: 600,
            fontSize: ".79rem"
          }}>
              {contactName}
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
        fontSize: 12,
        flex: 1
      }}>
            {ticket.user.name}
          </Typography>}
        {ticket.awaitingPatientSince && <Chip className={`${classes.chip} ${classes.chipInfo}`} variant="outlined" label="Aguardando paciente" />}
        {ticket.status === "closed" && <Chip className={`${classes.chip} ${classes.chipSuccess}`} variant="outlined" label={ticket.closedByInactivity ? "Resolvido por inatividade" : "Resolvido"} />}
        {ticket.status === "pending" && <>
          <Chip className={`${classes.chip} ${classes.chipWarning}`} variant="outlined" label="Na fila" />
          <Box ml="auto">
            <Button size="small" color="primary" disabled={loading} onClick={accept}>
              {loading ? "Aceitando…" : "Aceitar"}
            </Button>
          </Box>
        </>}
      </div>
    </div>;
}
