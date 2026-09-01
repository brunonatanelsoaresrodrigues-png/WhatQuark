import React, { useCallback, useEffect, useState } from "react";
import {
  Button,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Typography,
  makeStyles
} from "@material-ui/core";
import RefreshIcon from "@material-ui/icons/Refresh";
import api from "../../services/api";
import openSocket from "../../services/socket-io";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
  root: { marginBottom: theme.spacing(2) },
  heading: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: theme.spacing(2), marginBottom: theme.spacing(1.5) },
  card: { padding: theme.spacing(1.5), height: "100%", borderRadius: 10 },
  cardTitle: { display: "flex", justifyContent: "space-between", gap: theme.spacing(1), alignItems: "flex-start" },
  detail: { marginTop: theme.spacing(1), minHeight: 40 },
  incidents: { marginTop: theme.spacing(1.5), padding: theme.spacing(1.5) },
  incident: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: theme.spacing(2), padding: theme.spacing(1, 0), borderTop: `1px solid ${theme.palette.divider}` }
}));

const statusLabel = { OK: "Saudável", WARNING: "Atenção", CRITICAL: "Crítico", UNKNOWN: "Sem dados" };

const OperationalHealthPanel = () => {
  const classes = useStyles();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (recheck = false) => {
    setLoading(true);
    try {
      const response = await api[recheck ? "post" : "get"](recheck ? "/admin/operations/health/recheck" : "/admin/operations/health");
      setHealth(response.data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    const socket = openSocket();
    socket.on("operationsHealth", setHealth);
    return () => {
      clearInterval(timer);
      socket.disconnect();
    };
  }, [load]);

  const acknowledge = async id => {
    try {
      await api.post(`/admin/operations/incidents/${id}/acknowledge`);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <section className={classes.root} aria-labelledby="operations-health-title">
      <div className={classes.heading}>
        <div>
          <Typography id="operations-health-title" variant="h6">Saúde operacional</Typography>
          <Typography variant="body2" color="textSecondary">Integrações, filas, dados e backup em uma única visão.</Typography>
        </div>
        <Button variant="outlined" color="primary" disabled={loading} startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />} onClick={() => load(true)}>Verificar agora</Button>
      </div>
      <Grid container spacing={2}>
        {(health?.checks || []).map(check => (
          <Grid key={check.key} item xs={12} sm={6} md={3}>
            <Paper variant="outlined" className={classes.card}>
              <div className={classes.cardTitle}>
                <Typography variant="subtitle2">{check.label}</Typography>
                <Chip size="small" color={check.status === "CRITICAL" ? "secondary" : check.status === "OK" ? "primary" : "default"} variant={check.status === "OK" ? "outlined" : "default"} label={statusLabel[check.status] || check.status} />
              </div>
              <Typography variant="body2" color="textSecondary" className={classes.detail}>{check.detail}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
      {health?.incidents?.length > 0 && (
        <Paper variant="outlined" className={classes.incidents}>
          <Typography variant="subtitle2">Alertas ativos</Typography>
          {health.incidents.map(incident => (
            <div key={incident.id} className={classes.incident}>
              <div>
                <Typography variant="body2">{incident.title}</Typography>
                <Typography variant="caption" color="textSecondary">{incident.detail}</Typography>
              </div>
              {incident.status === "OPEN" ? <Button size="small" onClick={() => acknowledge(incident.id)}>Marcar como visto</Button> : <Chip size="small" label="Visto" />}
            </div>
          ))}
        </Paper>
      )}
    </section>
  );
};

export default OperationalHealthPanel;
