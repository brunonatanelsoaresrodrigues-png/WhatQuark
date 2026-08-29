import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Grid,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  makeStyles
} from "@material-ui/core";
import Skeleton from "@material-ui/lab/Skeleton";
import AccessTimeOutlinedIcon from "@material-ui/icons/AccessTimeOutlined";
import AssignmentTurnedInOutlinedIcon from "@material-ui/icons/AssignmentTurnedInOutlined";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import ErrorOutlineIcon from "@material-ui/icons/ErrorOutline";
import EventAvailableOutlinedIcon from "@material-ui/icons/EventAvailableOutlined";
import ForumOutlinedIcon from "@material-ui/icons/ForumOutlined";
import HeadsetMicOutlinedIcon from "@material-ui/icons/HeadsetMicOutlined";
import HourglassEmptyIcon from "@material-ui/icons/HourglassEmpty";
import MailOutlineIcon from "@material-ui/icons/MailOutline";
import PeopleOutlineIcon from "@material-ui/icons/PeopleOutline";
import ScheduleOutlinedIcon from "@material-ui/icons/ScheduleOutlined";
import TodayOutlinedIcon from "@material-ui/icons/TodayOutlined";
import TrendingUpOutlinedIcon from "@material-ui/icons/TrendingUpOutlined";
import WifiIcon from "@material-ui/icons/Wifi";
import { useHistory } from "react-router-dom";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import openSocket from "../../services/socket-io";
import toastError from "../../errors/toastError";
import useWhatsApps from "../../hooks/useWhatsApps";
import Chart from "./Chart";
import UserAvatar from "../../components/UserAvatar";

const useStyles = makeStyles(theme => ({
  container: {
    width: "100%",
    maxWidth: 1560,
    paddingTop: theme.spacing(2.25),
    paddingBottom: theme.spacing(4),
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(1.5)
    }
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    minHeight: 92,
    marginBottom: theme.spacing(2),
    padding: theme.spacing(2.25, 2.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 16,
    background:
      theme.palette.type === "dark"
        ? "linear-gradient(110deg, rgba(11,39,66,.72), rgba(9,74,82,.28))"
        : "linear-gradient(110deg, #FFFFFF, #F2FAFA)",
    boxShadow: theme.productTokens.shadows.rest,
    [theme.breakpoints.down("sm")]: {
      alignItems: "flex-start",
      flexDirection: "column"
    }
  },
  headerTitle: {
    color: theme.palette.text.primary,
    fontWeight: 800,
    letterSpacing: "-.025em"
  },
  headerSubtitle: {
    marginTop: 3,
    color: theme.palette.text.secondary
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    [theme.breakpoints.down("sm")]: {
      width: "100%",
      justifyContent: "flex-start"
    }
  },
  onlineChip: {
    color: theme.palette.type === "dark" ? "#8EE3D6" : "#08766C",
    background: theme.palette.type === "dark" ? "#0C2D32" : "#E7F7F1",
    borderColor: theme.palette.type === "dark" ? "#18545A" : "#BDE8D8",
    "& .MuiChip-icon": { color: "inherit" }
  },
  offlineChip: {
    color: theme.palette.error.main,
    background: theme.palette.type === "dark" ? "#351D24" : "#FFF1F2",
    borderColor: theme.palette.type === "dark" ? "#65303B" : "#F2C7CD",
    "& .MuiChip-icon": { color: "inherit" }
  },
  filters: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2)
  },
  todayChip: {
    height: 40,
    color: theme.palette.primary.main,
    background: theme.modeTokens.surfaceTint,
    borderColor: theme.palette.divider,
    "& .MuiChip-icon": { color: "inherit" }
  },
  filter: {
    minWidth: 190,
    "& .MuiOutlinedInput-root": {
      height: 40,
      background: theme.palette.background.paper
    },
    [theme.breakpoints.down("xs")]: {
      minWidth: 0,
      flex: "1 1 150px"
    }
  },
  sectionLabel: {
    display: "block",
    margin: theme.spacing(0.5, 0, 1),
    color: theme.palette.text.secondary,
    fontSize: ".67rem",
    fontWeight: 800,
    letterSpacing: ".1em",
    textTransform: "uppercase"
  },
  metric: {
    position: "relative",
    height: "100%",
    minHeight: 122,
    overflow: "hidden",
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 14,
    boxShadow: theme.productTokens.shadows.rest,
    transition: "transform 160ms ease, box-shadow 160ms ease",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: theme.productTokens.shadows.raised
    }
  },
  metricWarning: {
    borderColor:
      theme.palette.type === "dark" ? "rgba(238,171,72,.42)" : "#F0D6A9",
    background:
      theme.palette.type === "dark"
        ? "linear-gradient(145deg, #171E27, #251F19)"
        : "linear-gradient(145deg, #FFFFFF, #FFF9EF)"
  },
  metricHeader: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.1)
  },
  metricIcon: {
    width: 36,
    height: 36,
    color: "var(--metric-color)",
    background: "var(--metric-bg)",
    borderRadius: 10,
    "& svg": { fontSize: 20 }
  },
  metricLabel: {
    color: theme.palette.text.secondary,
    fontSize: ".76rem",
    fontWeight: 650
  },
  metricValue: {
    marginTop: theme.spacing(1),
    color: theme.palette.text.primary,
    fontSize: "1.68rem",
    fontWeight: 800,
    lineHeight: 1.05,
    letterSpacing: "-.035em"
  },
  metricMeta: {
    display: "block",
    marginTop: theme.spacing(0.7),
    color: "var(--meta-color)",
    fontSize: ".68rem",
    fontWeight: 650
  },
  panel: {
    height: 360,
    padding: theme.spacing(2.25),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 14,
    boxShadow: theme.productTokens.shadows.rest,
    [theme.breakpoints.down("xs")]: {
      height: 330,
      padding: theme.spacing(1.5)
    }
  },
  panelHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  panelTitle: {
    color: theme.palette.text.primary,
    fontWeight: 750,
    letterSpacing: "-.015em"
  },
  panelCaption: {
    color: theme.palette.text.secondary,
    fontSize: ".7rem"
  },
  chart: {
    height: 285,
    [theme.breakpoints.down("xs")]: { height: 255 }
  },
  attentionPanel: {
    display: "flex",
    flexDirection: "column"
  },
  attentionList: {
    display: "flex",
    flex: 1,
    minHeight: 0,
    flexDirection: "column",
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(0.5)
  },
  alert: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.2),
    minHeight: 48,
    padding: theme.spacing(1, 1.15),
    color: theme.palette.text.primary,
    background: theme.modeTokens.surfaceMuted,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 10
  },
  alertIcon: {
    display: "grid",
    width: 30,
    height: 30,
    flex: "0 0 auto",
    placeItems: "center",
    color: "var(--alert-color)",
    background: "var(--alert-bg)",
    borderRadius: 8,
    "& svg": { fontSize: 18 }
  },
  alertText: {
    flex: 1,
    minWidth: 0,
    fontSize: ".75rem",
    fontWeight: 650
  },
  quickActions: {
    display: "flex",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.25),
    "& > *": { flex: 1 },
    "& .MuiButton-root": { textTransform: "none" }
  },
  tablePaper: {
    overflow: "hidden",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 14,
    boxShadow: theme.productTokens.shadows.rest
  },
  tableHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    padding: theme.spacing(1.6, 2)
  },
  table: {
    minWidth: 720,
    "& .MuiTableCell-root": {
      padding: theme.spacing(1.15, 2),
      borderColor: theme.palette.divider,
      fontSize: ".73rem"
    },
    "& .MuiTableCell-head": {
      color: theme.palette.text.secondary,
      background: theme.modeTokens.surfaceMuted,
      fontWeight: 750
    }
  },
  agent: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1)
  },
  agentAvatar: {
    width: 28,
    height: 28,
    color: "#fff",
    background: theme.palette.primary.main,
    fontSize: ".65rem",
    fontWeight: 750
  },
  statusChip: {
    height: 22,
    fontSize: ".62rem",
    fontWeight: 700
  },
  empty: {
    display: "grid",
    minHeight: 90,
    color: theme.palette.text.secondary,
    placeItems: "center"
  }
}));

const formatDuration = value => {
  if (value === null || value === undefined || !Number.isFinite(Number(value)))
    return "—";
  const seconds = Math.max(0, Math.round(Number(value)));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0"
      )}:${String(rest).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
};

const initials = name =>
  String(name || "A")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();

const percentComparison = (value, positiveIsGood = true) => {
  if (value === null || value === undefined)
    return { text: "Sem base de comparação", tone: "neutral" };
  if (!value) return { text: "Sem variação vs ontem", tone: "neutral" };
  return {
    text: `${value > 0 ? "+" : ""}${value}% vs ontem`,
    tone: (value > 0) === positiveIsGood ? "good" : "warning"
  };
};

const secondsComparison = value => {
  if (value === null || value === undefined)
    return { text: "Sem base de comparação", tone: "neutral" };
  if (!value) return { text: "Sem variação vs ontem", tone: "neutral" };
  return {
    text: `${value > 0 ? "+" : "−"}${formatDuration(Math.abs(value))} vs ontem`,
    tone: value < 0 ? "good" : "warning"
  };
};

const MetricCard = ({
  icon,
  label,
  value,
  meta,
  metaTone = "neutral",
  warning = false,
  loading = false,
  color = "#087D9B",
  background = "rgba(8,125,155,.1)"
}) => {
  const classes = useStyles();
  const metaColors = {
    good: "#17865D",
    warning: "#D16A19",
    neutral: "#738296"
  };
  return (
    <Paper
      elevation={0}
      className={`${classes.metric} ${warning ? classes.metricWarning : ""}`}
      style={{
        "--metric-color": color,
        "--metric-bg": background,
        "--meta-color": metaColors[metaTone] || metaColors.neutral
      }}
    >
      <div className={classes.metricHeader}>
        <Avatar variant="rounded" className={classes.metricIcon}>
          {icon}
        </Avatar>
        <span className={classes.metricLabel}>{label}</span>
      </div>
      <div className={classes.metricValue}>
        {loading ? <Skeleton width={72} /> : value}
      </div>
      <span className={classes.metricMeta}>
        {loading ? <Skeleton width="68%" /> : meta}
      </span>
    </Paper>
  );
};

const Dashboard = () => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const { whatsApps, loading: loadingWhatsApps } = useWhatsApps();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [queues, setQueues] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [queueId, setQueueId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const userQueueIds = useMemo(
    () => (user.queues || []).map(queue => Number(queue.id)),
    [user.queues]
  );

  const loadMetrics = useCallback(async () => {
    try {
      const { data } = await api.get("/ticket-metrics/operations", {
        params: {
          queueId: queueId || undefined,
          assigneeId: assigneeId || undefined
        }
      });
      setMetrics(data);
    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false);
    }
  }, [queueId, assigneeId]);

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/queue"), api.get("/users/assignees")])
      .then(([queueResponse, assigneeResponse]) => {
        if (!active) return;
        setQueues(
          user.profile === "admin"
            ? queueResponse.data
            : queueResponse.data.filter(queue =>
                userQueueIds.includes(Number(queue.id))
              )
        );
        setAssignees(assigneeResponse.data);
      })
      .catch(error => active && toastError(error));
    return () => {
      active = false;
    };
  }, [user.profile, userQueueIds]);

  useEffect(() => {
    setLoading(true);
    loadMetrics();
    const interval = setInterval(loadMetrics, 30000);
    const socket = openSocket();
    let debounce;
    socket.on("ticket", () => {
      clearTimeout(debounce);
      debounce = setTimeout(loadMetrics, 700);
    });
    return () => {
      clearInterval(interval);
      clearTimeout(debounce);
      socket.disconnect();
    };
  }, [loadMetrics]);

  const connectedChannels = whatsApps.filter(
    whatsapp => whatsapp.status === "CONNECTED"
  ).length;
  const allChannelsConnected =
    whatsApps.length > 0 && connectedChannels === whatsApps.length;
  const firstName = (user.name || "Equipe").trim().split(/\s+/)[0];
  const quarkPath =
    user.profile === "admin"
      ? "/quark-dashboard"
      : user.canAccessQuarkClinic
      ? "/quark-clinic"
      : null;
  const now = metrics?.now || {};
  const today = metrics?.today || {};
  const comparison = metrics?.comparison || {};
  const entryComparison = percentComparison(comparison.entriesPercent, true);
  const resolvedComparison = percentComparison(
    comparison.resolvedPercent,
    true
  );
  const waitComparison = secondsComparison(comparison.averageWaitSeconds);
  const resolutionComparison = {
    text:
      comparison.resolutionPoints === null ||
      comparison.resolutionPoints === undefined
        ? "Sem base de comparação"
        : `${comparison.resolutionPoints > 0 ? "+" : ""}${
            comparison.resolutionPoints
          } p.p. vs ontem`,
    tone:
      comparison.resolutionPoints > 0
        ? "good"
        : comparison.resolutionPoints < 0
        ? "warning"
        : "neutral"
  };
  const aboveSla = Number(now.aboveSla || 0);
  const unassigned = Number(now.unassigned || 0);
  const highestQueue = metrics?.attention?.highestDemandQueue;

  const alerts = [];
  if (aboveSla > 0)
    alerts.push({
      key: "sla",
      color: "#E27127",
      background: "rgba(226,113,39,.12)",
      icon: <ErrorOutlineIcon />,
      text: `${aboveSla} conversa${aboveSla === 1 ? "" : "s"} acima do SLA de ${
        metrics?.slaMinutes || 5
      } min`
    });
  if (unassigned > 0)
    alerts.push({
      key: "unassigned",
      color: "#C88A12",
      background: "rgba(200,138,18,.12)",
      icon: <PeopleOutlineIcon />,
      text: `${unassigned} conversa${unassigned === 1 ? "" : "s"} sem responsável`
    });
  if (highestQueue)
    alerts.push({
      key: "queue",
      color: "#087D9B",
      background: "rgba(8,125,155,.12)",
      icon: <TrendingUpOutlinedIcon />,
      text: `Maior demanda: ${highestQueue.name} · ${highestQueue.total} ativa${
        highestQueue.total === 1 ? "" : "s"
      }`
    });
  if (!loadingWhatsApps && !allChannelsConnected)
    alerts.push({
      key: "channel",
      color: "#C74755",
      background: "rgba(199,71,85,.12)",
      icon: <WifiIcon />,
      text: `${connectedChannels}/${whatsApps.length} canais conectados`
    });
  if (!aboveSla && allChannelsConnected)
    alerts.push({
      key: "healthy",
      color: "#27865C",
      background: "rgba(39,134,92,.12)",
      icon: <CheckCircleOutlineIcon />,
      text: "Operação dentro do SLA e WhatsApp conectado"
    });

  return (
    <Container maxWidth={false} className={classes.container}>
      <Paper elevation={0} className={classes.header}>
        <Box>
          <Typography variant="h5" component="h1" className={classes.headerTitle}>
            Olá, {firstName}! 👋
          </Typography>
          <Typography variant="body2" className={classes.headerSubtitle}>
            Essencial Saúde · Operação em tempo real
          </Typography>
        </Box>
        <div className={classes.headerActions}>
          <Chip
            variant="outlined"
            size="small"
            icon={<WifiIcon />}
            className={
              allChannelsConnected ? classes.onlineChip : classes.offlineChip
            }
            label={
              loadingWhatsApps
                ? "Verificando WhatsApp"
                : allChannelsConnected
                ? "WhatsApp online"
                : `${connectedChannels}/${whatsApps.length} online`
            }
          />
          {quarkPath && (
            <Button
              size="small"
              color="primary"
              variant="outlined"
              startIcon={<EventAvailableOutlinedIcon />}
              onClick={() => history.push(quarkPath)}
            >
              Agenda Quark
            </Button>
          )}
        </div>
      </Paper>

      <div className={classes.filters}>
        <Chip
          variant="outlined"
          icon={<TodayOutlinedIcon />}
          label="Hoje"
          className={classes.todayChip}
        />
        <TextField
          select
          size="small"
          variant="outlined"
          label="Fila"
          value={queueId}
          onChange={event => setQueueId(event.target.value)}
          className={classes.filter}
        >
          <MenuItem value="">Todas as filas</MenuItem>
          {queues.map(queue => (
            <MenuItem key={queue.id} value={queue.id}>
              {queue.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          variant="outlined"
          label="Atendente"
          value={assigneeId}
          onChange={event => setAssigneeId(event.target.value)}
          className={classes.filter}
        >
          <MenuItem value="">Todos os atendentes</MenuItem>
          {assignees.map(agent => (
            <MenuItem key={agent.id} value={agent.id}>
              {agent.name}
            </MenuItem>
          ))}
        </TextField>
      </div>

      <span className={classes.sectionLabel}>Atenção agora</span>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            loading={loading}
            warning={aboveSla > 0}
            color="#E27127"
            background="rgba(226,113,39,.12)"
            icon={<HourglassEmptyIcon />}
            label="Aguardando"
            value={now.waiting ?? 0}
            meta={
              aboveSla
                ? `${aboveSla} acima do SLA`
                : "Nenhuma espera acima do SLA"
            }
            metaTone={aboveSla ? "warning" : "good"}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            loading={loading}
            color="#087D83"
            background="rgba(8,125,131,.11)"
            icon={<HeadsetMicOutlinedIcon />}
            label="Em atendimento"
            value={now.active ?? 0}
            meta={`${Number(now.active || 0)} conversa${
              Number(now.active || 0) === 1 ? "" : "s"
            } ativa${Number(now.active || 0) === 1 ? "" : "s"}`}
            metaTone="neutral"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            loading={loading}
            warning={aboveSla > 0}
            color="#3978E6"
            background="rgba(57,120,230,.11)"
            icon={<AccessTimeOutlinedIcon />}
            label="Maior espera"
            value={formatDuration(now.maximumWaitSeconds || 0)}
            meta={`Meta: < ${metrics?.slaMinutes || 5} min`}
            metaTone={aboveSla ? "warning" : "good"}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            loading={loading}
            color="#27865C"
            background="rgba(39,134,92,.11)"
            icon={<MailOutlineIcon />}
            label="Não lidas"
            value={now.unread ?? 0}
            meta={Number(now.unread) ? "Requer acompanhamento" : "Tudo em dia"}
            metaTone={Number(now.unread) ? "warning" : "good"}
          />
        </Grid>
      </Grid>

      <span className={classes.sectionLabel} style={{ marginTop: 18 }}>
        Desempenho de hoje
      </span>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            loading={loading}
            icon={<TrendingUpOutlinedIcon />}
            label="Entradas hoje"
            value={today.entries ?? 0}
            meta={entryComparison.text}
            metaTone={entryComparison.tone}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            loading={loading}
            color="#27865C"
            background="rgba(39,134,92,.11)"
            icon={<AssignmentTurnedInOutlinedIcon />}
            label="Finalizados hoje"
            value={today.resolved ?? 0}
            meta={resolvedComparison.text}
            metaTone={resolvedComparison.tone}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            loading={loading}
            color="#0C8C92"
            background="rgba(12,140,146,.11)"
            icon={<ScheduleOutlinedIcon />}
            label="Tempo médio de espera"
            value={formatDuration(today.averageWaitSeconds)}
            meta={waitComparison.text}
            metaTone={waitComparison.tone}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            loading={loading}
            color="#7957A5"
            background="rgba(121,87,165,.11)"
            icon={<CheckCircleOutlineIcon />}
            label="Índice de resolução"
            value={`${Number(today.resolutionRate || 0).toFixed(1)}%`}
            meta={resolutionComparison.text}
            metaTone={resolutionComparison.tone}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} style={{ marginTop: 2 }}>
        <Grid item xs={12} lg={8}>
          <Paper elevation={0} className={classes.panel}>
            <div className={classes.panelHeader}>
              <Box>
                <Typography variant="h6" className={classes.panelTitle}>
                  Fluxo de atendimentos hoje
                </Typography>
                <span className={classes.panelCaption}>
                  Entradas e finalizações por hora · Atualizado agora
                </span>
              </Box>
              <Chip size="small" variant="outlined" label="Hoje" />
            </div>
            <div className={classes.chart}>
              {loading ? <Skeleton variant="rect" height="100%" /> : <Chart data={metrics?.flow} />}
            </div>
          </Paper>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Paper
            elevation={0}
            className={`${classes.panel} ${classes.attentionPanel}`}
          >
            <div className={classes.panelHeader}>
              <Box>
                <Typography variant="h6" className={classes.panelTitle}>
                  Atenção agora
                </Typography>
                <span className={classes.panelCaption}>
                  Somente o que pode exigir intervenção
                </span>
              </Box>
            </div>
            <div className={classes.attentionList}>
              {loading
                ? [0, 1, 2, 3].map(item => (
                    <Skeleton key={item} variant="rect" height={48} />
                  ))
                : alerts.slice(0, 4).map(alert => (
                    <div key={alert.key} className={classes.alert}>
                      <span
                        className={classes.alertIcon}
                        style={{
                          "--alert-color": alert.color,
                          "--alert-bg": alert.background
                        }}
                      >
                        {alert.icon}
                      </span>
                      <span className={classes.alertText}>{alert.text}</span>
                    </div>
                  ))}
            </div>
            <div className={classes.quickActions}>
              <Button
                size="small"
                color="primary"
                variant="outlined"
                onClick={() => history.push("/tickets")}
              >
                Ver fila
              </Button>
              <Button
                size="small"
                color="primary"
                variant="contained"
                startIcon={<ForumOutlinedIcon />}
                onClick={() => history.push("/tickets")}
              >
                Abrir conversas
              </Button>
            </div>
          </Paper>
        </Grid>
      </Grid>

      <Paper elevation={0} className={classes.tablePaper} style={{ marginTop: 16 }}>
        <div className={classes.tableHeader}>
          <Box>
            <Typography variant="h6" className={classes.panelTitle}>
              Desempenho por atendente
            </Typography>
            <span className={classes.panelCaption}>
              Tempos calculados pelos eventos registrados hoje
            </span>
          </Box>
          <Button
            size="small"
            color="primary"
            onClick={() => history.push("/tickets")}
          >
            Ver conversas
          </Button>
        </div>
        <TableContainer>
          <Table size="small" className={classes.table}>
            <TableHead>
              <TableRow>
                <TableCell>Atendente</TableCell>
                <TableCell align="center">Em atendimento</TableCell>
                <TableCell align="center">Finalizados</TableCell>
                <TableCell align="center">TME</TableCell>
                <TableCell align="center">Tempo médio</TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [0, 1, 2].map(row => (
                  <TableRow key={row}>
                    <TableCell colSpan={6}>
                      <Skeleton />
                    </TableCell>
                  </TableRow>
                ))
              ) : metrics?.agents?.length ? (
                metrics.agents.slice(0, 8).map(agent => (
                  <TableRow key={agent.id} hover>
                    <TableCell>
                      <div className={classes.agent}>
                        <UserAvatar
                          user={agent}
                          className={classes.agentAvatar}
                        />
                        <strong>{agent.name}</strong>
                      </div>
                    </TableCell>
                    <TableCell align="center">{agent.active}</TableCell>
                    <TableCell align="center">{agent.resolved}</TableCell>
                    <TableCell align="center">
                      {formatDuration(agent.averageWaitSeconds)}
                    </TableCell>
                    <TableCell align="center">
                      {formatDuration(agent.averageServiceSeconds)}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        size="small"
                        className={classes.statusChip}
                        label={
                          agent.status === "WITHIN_SLA"
                            ? "Dentro do SLA"
                            : agent.status === "ATTENTION"
                            ? "Atenção"
                            : "Sem amostra"
                        }
                        style={{
                          color:
                            agent.status === "ATTENTION"
                              ? "#B45A17"
                              : agent.status === "WITHIN_SLA"
                              ? "#17714F"
                              : undefined,
                          background:
                            agent.status === "ATTENTION"
                              ? "rgba(226,113,39,.13)"
                              : agent.status === "WITHIN_SLA"
                              ? "rgba(39,134,92,.13)"
                              : undefined
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className={classes.empty}>
                      Nenhuma atividade de atendente registrada hoje.
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
};

export default Dashboard;
