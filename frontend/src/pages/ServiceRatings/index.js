import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { format } from "date-fns";

import MainContainer from "../../components/MainContainer";
import PageHeading from "../../components/PageHeading";
import ResponsiveTable from "../../components/ResponsiveTable";
import TableEmptyState from "../../components/TableEmptyState";
import api from "../../services/api";
import openSocket from "../../services/socket-io";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
  metric: {
    ...theme.panelStyles,
    padding: theme.spacing(2),
    height: "100%"
  },
  metricValue: {
    marginTop: theme.spacing(0.5),
    fontSize: "1.65rem",
    fontWeight: 700,
    color: theme.palette.text.primary
  },
  tablePaper: {
    ...theme.panelStyles,
    marginTop: theme.spacing(2)
  },
  sectionTitle: {
    padding: theme.spacing(2, 2, 0),
    fontWeight: 650
  },
  score: {
    color: theme.palette.warning.dark,
    fontWeight: 700
  }
}));

const scoreLabel = value =>
  value === null || value === undefined ? "Sem respostas" : `${value} / 5`;

const statusLabel = {
  PENDING: "Pendente",
  SENT: "Enviada",
  ANSWERED: "Respondida",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
  FAILED: "Falhou"
};

const triggerLabel = {
  MANUAL_RESOLUTION: "Resolução",
  INACTIVITY: "Inatividade"
};

const ServiceRatings = () => {
  const classes = useStyles();
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [ratings, setRatings] = useState([]);

  const load = useCallback(async () => {
    try {
      const [summaryResponse, ratingsResponse] = await Promise.all([
        api.get("/service-ratings/summary", { params: { days } }),
        api.get("/service-ratings", { params: { days } })
      ]);
      setSummary(summaryResponse.data);
      setRatings(ratingsResponse.data.ratings || []);
    } catch (error) {
      toastError(error);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const socket = openSocket();
    socket.on("serviceRating", load);
    return () => socket.disconnect();
  }, [load]);

  const team = summary?.team || {};

  return (
    <MainContainer>
      <PageHeading
        title="Avaliação dos atendimentos"
        description="Notas dadas pelos pacientes, pontuação da equipe e taxa de resposta."
        actions={
          <FormControl variant="outlined" size="small">
            <InputLabel id="rating-period-label">Período</InputLabel>
            <Select
              labelId="rating-period-label"
              value={days}
              onChange={event => setDays(event.target.value)}
              label="Período"
            >
              <MenuItem value={7}>7 dias</MenuItem>
              <MenuItem value={30}>30 dias</MenuItem>
              <MenuItem value={90}>90 dias</MenuItem>
              <MenuItem value={365}>12 meses</MenuItem>
            </Select>
          </FormControl>
        }
      />

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper className={classes.metric} variant="outlined">
            <Typography color="textSecondary">Média da equipe</Typography>
            <div className={`${classes.metricValue} ${classes.score}`}>
              ★ {scoreLabel(team.average)}
            </div>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper className={classes.metric} variant="outlined">
            <Typography color="textSecondary">Pontuação</Typography>
            <div className={classes.metricValue}>{team.points ?? "—"} pontos</div>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper className={classes.metric} variant="outlined">
            <Typography color="textSecondary">Respostas</Typography>
            <div className={classes.metricValue}>{team.answered || 0}</div>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper className={classes.metric} variant="outlined">
            <Typography color="textSecondary">Taxa de resposta</Typography>
            <div className={classes.metricValue}>{team.responseRate || 0}%</div>
          </Paper>
        </Grid>
      </Grid>

      <Paper className={classes.tablePaper} variant="outlined">
        <Typography className={classes.sectionTitle}>Pontuação por atendente</Typography>
        <ResponsiveTable size="medium" aria-label="Pontuação por atendente">
          <TableHead>
            <TableRow>
              <TableCell>Atendente</TableCell>
              <TableCell align="center">Média</TableCell>
              <TableCell align="center">Pontos</TableCell>
              <TableCell align="center">Respostas</TableCell>
              <TableCell align="center">Taxa de resposta</TableCell>
              <TableCell align="center">Distribuição 0–5</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(summary?.users || []).map(user => (
              <TableRow key={user.userId}>
                <TableCell data-mobile-primary>{user.name}</TableCell>
                <TableCell data-label="Média" align="center" className={classes.score}>
                  ★ {scoreLabel(user.average)}
                </TableCell>
                <TableCell data-label="Pontos" align="center">
                  {user.points ?? "—"}
                </TableCell>
                <TableCell data-label="Respostas" align="center">
                  {user.answered} de {user.requested}
                </TableCell>
                <TableCell data-label="Taxa" align="center">
                  {user.responseRate}%
                </TableCell>
                <TableCell data-label="Distribuição" align="center">
                  {(user.distribution || []).map((count, score) => `${score}: ${count}`).join(" · ")}
                </TableCell>
              </TableRow>
            ))}
            {summary && summary.users.length === 0 && <TableEmptyState columns={6} />}
          </TableBody>
        </ResponsiveTable>
      </Paper>

      <Paper className={classes.tablePaper} variant="outlined">
        <Typography className={classes.sectionTitle}>Pesquisas recentes</Typography>
        <ResponsiveTable size="medium" aria-label="Pesquisas recentes">
          <TableHead>
            <TableRow>
              <TableCell>Data</TableCell>
              <TableCell>Atendente</TableCell>
              <TableCell>Motivo</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="center">Nota</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ratings.map(rating => (
              <TableRow key={rating.id}>
                <TableCell data-mobile-primary>
                  {format(new Date(rating.requestedAt || rating.createdAt), "dd/MM/yyyy HH:mm")}
                </TableCell>
                <TableCell data-label="Atendente">
                  {rating.ratedUserName || rating.ratedUser?.name || "Atendente removido"}
                </TableCell>
                <TableCell data-label="Motivo">{triggerLabel[rating.trigger] || rating.trigger}</TableCell>
                <TableCell data-label="Status" align="center">{statusLabel[rating.status] || rating.status}</TableCell>
                <TableCell data-label="Nota" align="center" className={classes.score}>
                  {rating.score === null ? "—" : `★ ${rating.score}`}
                </TableCell>
              </TableRow>
            ))}
            {ratings.length === 0 && <TableEmptyState columns={5} />}
          </TableBody>
        </ResponsiveTable>
        <Box p={2} color="text.secondary">
          O ranking é considerado confiável a partir de 10 respostas por atendente.
        </Box>
      </Paper>
    </MainContainer>
  );
};

export default ServiceRatings;
