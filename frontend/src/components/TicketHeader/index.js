import React from "react";

import { Card, IconButton } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import TicketHeaderSkeleton from "../TicketHeaderSkeleton";
import ArrowBackIos from "@material-ui/icons/ArrowBackIos";
import { useHistory } from "react-router-dom";

const useStyles = makeStyles(theme => ({
  ticketHeader: {
    display: "flex",
    backgroundColor: theme.palette.background.paper,
    flex: "none",
    flexWrap: "nowrap",
    alignItems: "center",
    minHeight: 72,
    padding: "6px 12px",
    gap: 6,
    border: 0,
    borderBottom: `1px solid ${theme.palette.divider}`,
    boxShadow: "none",
    [theme.breakpoints.down("sm")]: {
      flexWrap: "wrap",
      minHeight: 64,
      padding: "4px 8px"
    }
  },
  backButton: {
    flexShrink: 0,
    color: theme.palette.text.secondary,
    background: theme.modeTokens.surfaceMuted
  }
}));

const TicketHeader = ({ loading, children }) => {
  const classes = useStyles();
  const history = useHistory();
  const handleBack = () => {
    history.push("/tickets");
  };

  return (
    <>
      {loading ? (
        <TicketHeaderSkeleton />
      ) : (
        <Card square className={classes.ticketHeader}>
          <IconButton
            aria-label="Voltar à lista de atendimentos"
            size="small"
            className={classes.backButton}
            onClick={handleBack}
          >
            <ArrowBackIos fontSize="small" />
          </IconButton>
          {children}
        </Card>
      )}
    </>
  );
};

export default TicketHeader;
