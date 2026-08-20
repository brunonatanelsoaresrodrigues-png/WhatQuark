import React, { useContext, useRef, useState } from "react";
import { Redirect } from "react-router-dom";
import {
  Button,
  CircularProgress,
  Paper,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import OpenInNewIcon from "@material-ui/icons/OpenInNew";
import RefreshIcon from "@material-ui/icons/Refresh";
import FullscreenIcon from "@material-ui/icons/Fullscreen";

import { AuthContext } from "../../context/Auth/AuthContext";
import { getQuarkClinicUrl } from "../../config";

const useStyles = makeStyles(theme => ({
  root: {
    height: "calc(100vh - 48px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: theme.palette.background.default
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    minHeight: 56,
    padding: theme.spacing(1, 2),
    borderRadius: 0,
    borderLeft: 0,
    borderRight: 0,
    flexShrink: 0,
    [theme.breakpoints.down("xs")]: {
      alignItems: "flex-start",
      flexDirection: "column",
      gap: theme.spacing(1)
    }
  },
  heading: {
    flex: 1,
    minWidth: 0
  },
  description: {
    color: theme.palette.text.secondary
  },
  actions: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap"
  },
  frameContainer: {
    position: "relative",
    flex: 1,
    minHeight: 0,
    backgroundColor: "#fff"
  },
  frame: {
    width: "100%",
    height: "100%",
    display: "block",
    border: 0,
    backgroundColor: "#fff"
  },
  loading: {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.palette.background.default
  },
  notice: {
    padding: theme.spacing(0.75, 2),
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.background.paper,
    borderTop: `1px solid ${theme.palette.divider}`,
    flexShrink: 0
  }
}));

const QuarkClinic = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const frameContainerRef = useRef(null);
  const [frameKey, setFrameKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const quarkClinicUrl = getQuarkClinicUrl();

  if (!user?.canAccessQuarkClinic) {
    return <Redirect to="/tickets" />;
  }

  const reloadFrame = () => {
    setLoading(true);
    setFrameKey(previousKey => previousKey + 1);
  };

  const openFullscreen = async () => {
    if (frameContainerRef.current?.requestFullscreen) {
      await frameContainerRef.current.requestFullscreen();
    }
  };

  return (
    <div className={classes.root}>
      <Paper className={classes.header} variant="outlined" square>
        <div className={classes.heading}>
          <Typography variant="h6">Quark Clinic</Typography>
          <Typography variant="body2" className={classes.description}>
            Acesso individual. O login é feito e mantido pelo próprio Quark
            neste navegador.
          </Typography>
        </div>
        <div className={classes.actions}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={reloadFrame}
          >
            Recarregar
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FullscreenIcon />}
            onClick={openFullscreen}
          >
            Tela cheia
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            href={quarkClinicUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir separadamente
          </Button>
        </div>
      </Paper>

      <div className={classes.frameContainer} ref={frameContainerRef}>
        {loading && (
          <div className={classes.loading}>
            <CircularProgress />
          </div>
        )}
        <iframe
          key={frameKey}
          className={classes.frame}
          src={quarkClinicUrl}
          title="Quark Clinic"
          onLoad={() => setLoading(false)}
          allow="clipboard-read; clipboard-write; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      <Typography variant="caption" className={classes.notice}>
        Em computador compartilhado, saia do Quark antes de trocar de usuário.
        Se a tela não carregar, use “Abrir separadamente”.
      </Typography>
    </div>
  );
};

export default QuarkClinic;
