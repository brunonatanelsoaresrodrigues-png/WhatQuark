import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import ErrorOutlineIcon from "@material-ui/icons/ErrorOutline";
import RefreshIcon from "@material-ui/icons/Refresh";
import WarningIcon from "@material-ui/icons/Warning";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  content: {
    overflowY: "auto",
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
  },
  statusBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    padding: theme.spacing(1.5, 2),
    marginBottom: theme.spacing(2),
    borderLeft: "5px solid",
    borderRadius: 8,
  },
  healthy: { borderColor: "#2e7d32", background: "rgba(46,125,50,.08)" },
  degraded: { borderColor: "#ed6c02", background: "rgba(237,108,2,.08)" },
  critical: { borderColor: "#d32f2f", background: "rgba(211,47,47,.08)" },
  metricCard: { height: "100%", borderRadius: 10 },
  metricLabel: {
    color: theme.palette.text.secondary,
    fontSize: ".74rem",
    fontWeight: 700,
    letterSpacing: ".04em",
    textTransform: "uppercase",
  },
  metricValue: { marginTop: theme.spacing(0.5), fontWeight: 800 },
  section: { marginTop: theme.spacing(2), borderRadius: 10 },
  sectionTitle: { padding: theme.spacing(2, 2, 0), fontWeight: 800 },
  connectionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    padding: theme.spacing(1.25, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  criticalText: { color: "#d32f2f", fontWeight: 800 },
  warningText: { color: "#ed6c02", fontWeight: 800 },
  okText: { color: "#2e7d32", fontWeight: 800 },
  table: { minWidth: 900 },
  empty: { padding: theme.spacing(4), textAlign: "center" },
}));

const dateTime = (value) =>
  value ? new Date(value).toLocaleString("pt-BR") : "—";

const statusLabel = {
  HEALTHY: "Operação saudável",
  DEGRADED: "Operação com atenção",
  CRITICAL: "Intervenção necessária",
};

const severityColor = (severity) => {
  if (severity === "CRITICAL") return "secondary";
  if (severity === "WARNING") return "default";
  return "primary";
};

const Metric = ({ label, value, detail }) => {
  const classes = useStyles();
  return (
    <Card variant="outlined" className={classes.metricCard}>
      <CardContent>
        <Typography className={classes.metricLabel}>{label}</Typography>
        <Typography variant="h5" className={classes.metricValue}>
          {value ?? "—"}
        </Typography>
        {detail && (
          <Typography variant="caption" color="textSecondary">
            {detail}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

const SystemHealth = () => {
  const classes = useStyles();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get("/operational-health");
      setOverview(data);
    } catch (error) {
      if (!silent) toastError(error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 15000);
    return () => clearInterval(timer);
  }, [load]);

  const acknowledge = async (id) => {
    setAcknowledging(id);
    try {
      await api.put(`/operational-health/alerts/${id}/acknowledge`);
      toast.success("Alerta reconhecido. A condição continuará sendo monitorada.");
      await load(true);
    } catch (error) {
      toastError(error);
    } finally {
      setAcknowledging(null);
    }
  };

  const bannerClass = useMemo(() => {
    if (!overview) return classes.degraded;
    if (overview.overallStatus === "HEALTHY") return classes.healthy;
    if (overview.overallStatus === "CRITICAL") return classes.critical;
    return classes.degraded;
  }, [classes, overview]);

  if (loading && !overview) {
    return (
      <MainContainer>
        <Box display="flex" flex={1} alignItems="center" justifyContent="center">
          <CircularProgress />
        </Box>
      </MainContainer>
    );
  }

  const queue = overview?.quark?.queue || {};
  const coverage = overview?.quark?.coverage || {};
  const responses = overview?.quark?.responses || {};
  const alerts = overview?.alerts || [];

  return (
    <MainContainer>
      <MainHeader>
        <Title>Saúde do Sistema</Title>
        <MainHeaderButtonsWrapper>
          <Button
            color="primary"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => load()}
            disabled={loading}
          >
            Atualizar
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <div className={classes.content}>
        <Paper className={`${classes.statusBanner} ${bannerClass}`} elevation={0}>
          <Box display="flex" alignItems="center" gridGap={10}>
            {overview?.overallStatus === "HEALTHY" ? (
              <CheckCircleOutlineIcon className={classes.okText} />
            ) : overview?.overallStatus === "CRITICAL" ? (
              <ErrorOutlineIcon className={classes.criticalText} />
            ) : (
              <WarningIcon className={classes.warningText} />
            )}
            <Box>
              <Typography variant="h6">
                {statusLabel[overview?.overallStatus] || "Estado desconhecido"}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Atualizado em {dateTime(overview?.generatedAt)} · processo ativo há {" "}
                {Math.floor((overview?.uptimeSeconds || 0) / 60)} minutos
              </Typography>
            </Box>
          </Box>
          <Chip
            label={`${alerts.length} alerta(s) ativo(s)`}
            color={alerts.some((item) => item.severity === "CRITICAL") ? "secondary" : "default"}
          />
        </Paper>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Metric
              label="Banco de dados"
              value={overview?.database?.status}
              detail={
                overview?.database?.latencyMs !== null
                  ? `${overview.database.latencyMs} ms`
                  : "sem resposta"
              }
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Metric
              label="Redis"
              value={overview?.redis?.status}
              detail={
                overview?.redis?.latencyMs !== null
                  ? `${overview.redis.latencyMs} ms`
                  : "sessões/cache"
              }
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Metric
              label="WhatsApp do Quark"
              value={overview?.whatsapp?.targetStatus || "NÃO CONFIGURADO"}
              detail={`última alteração: ${dateTime(overview?.whatsapp?.targetUpdatedAt)}`}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Metric
              label="Sincronização Quark"
              value={overview?.quark?.syncStatus || (overview?.quark?.enabled ? "SEM DADOS" : "DESATIVADA")}
              detail={`último sucesso: ${dateTime(overview?.quark?.lastSuccessfulSyncAt)}`}
            />
          </Grid>

          <Grid item xs={6} sm={4} md={2}>
            <Metric label="Pendentes" value={queue.pending} detail={dateTime(queue.oldestPendingAt)} />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Metric label="Retentativas" value={queue.retrying} />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Metric label="Em processamento" value={queue.processing} detail={`${queue.stuckProcessing || 0} presa(s)`} />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Metric label="Em retenção" value={queue.deadLetter} />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Metric label="Enviadas na hora" value={queue.sentLastHour} detail={dateTime(queue.lastSentAt)} />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Metric label="Suprimidas" value={queue.suppressed} />
          </Grid>

          <Grid item xs={12} sm={4}>
            <Metric label="Consultas futuras" value={coverage.upcomingScheduled} detail="próximos 30 dias" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Metric label="Sem cobertura" value={coverage.uncoveredUpcoming} detail="exige correção ou justificativa" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Metric label="Cancelamentos sem aviso" value={coverage.cancelledWithoutNotification} detail="últimas 24 horas" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Metric label="Respostas processando" value={responses.processing} detail={`${responses.stuckProcessing || 0} atrasada(s)`} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Metric label="Falhas de confirmação" value={responses.failedLast24Hours} detail="últimas 24 horas" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Metric label="Última confirmação aplicada" value={dateTime(responses.lastAppliedAt)} />
          </Grid>
        </Grid>

        <Paper className={classes.section}>
          <Typography variant="h6" className={classes.sectionTitle}>
            Conexões do WhatsApp
          </Typography>
          {(overview?.whatsapp?.connections || []).map((connection) => (
            <div className={classes.connectionRow} key={connection.id}>
              <Box>
                <Typography variant="subtitle2">
                  {connection.name} {connection.isDefault ? "· padrão" : ""}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  ID {connection.id} · alterada em {dateTime(connection.updatedAt)}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={connection.status}
                color={connection.status === "CONNECTED" ? "primary" : "secondary"}
              />
            </div>
          ))}
          {!overview?.whatsapp?.connections?.length && (
            <div className={classes.empty}>Nenhuma conexão cadastrada.</div>
          )}
        </Paper>

        <Paper className={classes.section}>
          <Typography variant="h6" className={classes.sectionTitle}>
            Alertas operacionais
          </Typography>
          <TableContainer>
            <Table className={classes.table} size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Severidade</TableCell>
                  <TableCell>Categoria</TableCell>
                  <TableCell>Alerta</TableCell>
                  <TableCell>Detectado</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Ação</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <Chip size="small" color={severityColor(alert.severity)} label={alert.severity} />
                    </TableCell>
                    <TableCell>{alert.category}</TableCell>
                    <TableCell>
                      <Typography variant="subtitle2">{alert.title}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {alert.message}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={`Primeira detecção: ${dateTime(alert.firstDetectedAt)}`}>
                        <span>{dateTime(alert.lastDetectedAt)}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{alert.status}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={alert.status === "ACKNOWLEDGED" || acknowledging === alert.id}
                        onClick={() => acknowledge(alert.id)}
                      >
                        {acknowledging === alert.id ? <CircularProgress size={16} /> : "Reconhecer"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!alerts.length && (
                  <TableRow>
                    <TableCell colSpan={6} className={classes.empty}>
                      Nenhum alerta operacional ativo.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </div>
    </MainContainer>
  );
};

export default SystemHealth;
