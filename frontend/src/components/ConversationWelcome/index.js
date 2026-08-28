import React, { useContext, useEffect, useState } from "react";
import { Button, Paper, Typography, makeStyles } from "@material-ui/core";
import ForumOutlinedIcon from "@material-ui/icons/ForumOutlined";
import ArrowForwardIcon from "@material-ui/icons/ArrowForward";
import AddIcon from "@material-ui/icons/Add";
import Skeleton from "@material-ui/lab/Skeleton";
import { AuthContext } from "../../context/Auth/AuthContext";
import NewTicketModal from "../NewTicketModal";
import api from "../../services/api";

const useStyles = makeStyles(theme => ({
  root: {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    display: "flex",
    padding: "clamp(24px, 4vw, 56px)",
    background: theme.palette.background.paper
  },
  content: { width: "100%", maxWidth: 680, margin: "auto" },
  visual: {
    width: 64,
    height: 64,
    display: "grid",
    placeItems: "center",
    borderRadius: 18,
    marginBottom: 28,
    background: theme.modeTokens.surfaceTint,
    color: theme.palette.primary.main
  },
  eyebrow: {
    display: "block",
    fontSize: 11,
    fontWeight: 750,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    marginBottom: 10
  },
  title: {
    fontSize: "clamp(26px, 3vw, 38px)",
    fontWeight: 800,
    letterSpacing: "-.035em",
    lineHeight: 1.18,
    marginBottom: 12
  },
  copy: { maxWidth: 450, lineHeight: 1.7 },
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 12,
    marginTop: 32,
    marginBottom: 24
  },
  stat: {
    padding: "18px 16px",
    border: `1px solid ${theme.palette.divider}`,
    background: theme.modeTokens.surfaceMuted
  },
  value: { fontSize: 28, fontWeight: 800, letterSpacing: "-.04em" },
  actions: { display: "flex", flexWrap: "wrap", gap: 10 },
  note: { display: "block", marginTop: 24 }
}));

export default function ConversationWelcome({ counts, onViewQueue }) {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [today, setToday] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .get("/ticket-metrics/daily")
        .then(({ data }) => {
          if (active) setToday(data.total);
        })
        .catch(() => {
          if (active) setToday(null);
        })
        .finally(() => {
          if (active) setMetricsLoading(false);
        });
    load();
    const timer = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  return (
    <section className={classes.root} aria-label="Resumo do atendimento">
      <div className={classes.content}>
        <div className={classes.visual}>
          <ForumOutlinedIcon style={{ fontSize: 32 }} />
        </div>
        <span className={classes.eyebrow}>Seu espaço de atendimento</span>
        <Typography component="h1" className={classes.title}>
          {greeting}, {user.name?.split(" ")[0] || "equipe"}.<br />
          Vamos cuidar de quem precisa?
        </Typography>
        <Typography color="textSecondary" className={classes.copy}>
          Selecione uma conversa para continuar de onde parou ou confira os
          pacientes que aguardam atendimento.
        </Typography>
        <div className={classes.stats}>
          {[
            ["Em atendimento", counts.open, counts.open == null],
            ["Aguardando", counts.pending, counts.pending == null],
            ["Entradas de hoje", today, metricsLoading]
          ].map(([label, value, loading]) => (
            <Paper className={classes.stat} key={label}>
              <Typography variant="caption" color="textSecondary">
                {label}
              </Typography>
              <Typography className={classes.value}>
                {loading ? <Skeleton width={48} /> : value ?? "—"}
              </Typography>
            </Paper>
          ))}
        </div>
        <div className={classes.actions}>
          <Button
            color="primary"
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={onViewQueue}
          >
            Ver fila de espera
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setNewTicketOpen(true)}
          >
            Novo atendimento
          </Button>
        </div>
        <Typography
          className={classes.note}
          variant="caption"
          color="textSecondary"
        >
          Contagens da fila respeitam os filtros. Entradas de hoje seguem o
          horário da clínica.
        </Typography>
      </div>
      <NewTicketModal
        modalOpen={newTicketOpen}
        onClose={() => setNewTicketOpen(false)}
      />
    </section>
  );
}
