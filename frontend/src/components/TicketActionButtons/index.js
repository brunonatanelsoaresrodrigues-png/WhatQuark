import React, { useContext, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import { Chip, IconButton, Tooltip } from "@material-ui/core";
import { HourglassEmpty, MoreVert, Replay, TimerOff } from "@material-ui/icons";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import TicketOptionsMenu from "../TicketOptionsMenu";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
const useStyles = makeStyles(() => ({
  actionButtons: {
    marginRight: 0,
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    justifyContent: "flex-end",
    flex: "0 1 auto",
    alignSelf: "center",
    marginLeft: "auto",
    "& > *": {
      margin: 0
    },
    "& .MuiButton-root": {
      minHeight: 32,
      fontSize: 11,
      padding: "5px 10px"
    },
    "& .MuiIconButton-root": {
      padding: 7
    }
  },
  countdown: {
    fontSize: 10,
    marginLeft: 4
  }
}));
const TicketActionButtons = ({
  ticket,
  context
}) => {
  const classes = useStyles();
  const history = useHistory();
  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState((context?.inactivityTimeoutMinutes || 15) * 60);
  const ticketOptionsMenuOpen = Boolean(anchorEl);
  const {
    user
  } = useContext(AuthContext);
  useEffect(() => {
    if (!ticket.awaitingPatientSince) {
      setRemainingSeconds((context?.inactivityTimeoutMinutes || 15) * 60);
      return undefined;
    }
    const updateRemaining = () => {
      const elapsed = Math.floor((Date.now() - new Date(ticket.awaitingPatientSince).getTime()) / 1000);
      setRemainingSeconds(Math.max(0, (context?.inactivityTimeoutMinutes || 15) * 60 - elapsed));
    };
    updateRemaining();
    const timer = setInterval(updateRemaining, 1000);
    return () => clearInterval(timer);
  }, [ticket.awaitingPatientSince, context?.inactivityTimeoutMinutes]);
  const remainingLabel = `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;
  const waitingLabel = ticket.awaitingPatientSince ? `Cancelar espera · ${remainingLabel} restantes` : `Aguardar paciente (${context?.inactivityTimeoutMinutes || 15} min)`;
  const handleOpenTicketOptionsMenu = e => {
    setAnchorEl(e.currentTarget);
  };
  const handleCloseTicketOptionsMenu = () => {
    setAnchorEl(null);
  };
  const handleUpdateTicketStatus = async (e, status, userId) => {
    setLoading(true);
    try {
      await api.put(`/tickets/${ticket.id}`, {
        status: status,
        userId: userId || null
      });
      setLoading(false);
      if (status === "open") {
        history.push(`/tickets/${ticket.id}`);
      } else {
        history.push("/tickets");
      }
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
  };
  const handleWaitingForPatient = async waiting => {
    setLoading(true);
    try {
      await api.post(`/tickets/${ticket.id}/awaiting-patient`, {
        waiting
      });
      toast.success(waiting ? i18n.t("messagesList.header.buttons.waitingPatientStarted") : i18n.t("messagesList.header.buttons.waitingPatientCancelled"));
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };
  return <div className={classes.actionButtons}>
      {ticket.status === "closed" && ticket.closedByInactivity && <Chip size="small" variant="outlined" color="secondary" label={i18n.t("messagesList.header.inactivityResolved")} />}
      {ticket.status === "closed" && <ButtonWithSpinner loading={loading} startIcon={<Replay />} size="small" onClick={e => handleUpdateTicketStatus(e, "open", user?.id)}>
          {i18n.t("messagesList.header.buttons.reopen")}
        </ButtonWithSpinner>}
      {ticket.status === "open" && <>
          <Tooltip title={waitingLabel}><span>
            <IconButton disabled={loading} aria-label={waitingLabel} color={ticket.awaitingPatientSince ? "secondary" : "default"} onClick={() => handleWaitingForPatient(!ticket.awaitingPatientSince)}>
              {ticket.awaitingPatientSince ? <TimerOff /> : <HourglassEmpty />}
              {ticket.awaitingPatientSince && <span className={classes.countdown}>{remainingLabel}</span>}
            </IconButton>
          </span></Tooltip>
          <ButtonWithSpinner loading={loading} size="small" variant="contained" color="primary" onClick={e => handleUpdateTicketStatus(e, "closed", user?.id)}>
            {i18n.t("messagesList.header.buttons.resolve")}
          </ButtonWithSpinner>
          <IconButton aria-label="Mais ações do atendimento" onClick={handleOpenTicketOptionsMenu}>
            <MoreVert />
          </IconButton>
          <TicketOptionsMenu ticket={ticket} onReturn={e => handleUpdateTicketStatus(e, "pending", null)} anchorEl={anchorEl} menuOpen={ticketOptionsMenuOpen} handleClose={handleCloseTicketOptionsMenu} />
        </>}
      {ticket.status === "pending" && <ButtonWithSpinner loading={loading} size="small" variant="contained" color="primary" onClick={e => handleUpdateTicketStatus(e, "open", user?.id)}>
          {i18n.t("messagesList.header.buttons.accept")}
        </ButtonWithSpinner>}
    </div>;
};
export default TicketActionButtons;
