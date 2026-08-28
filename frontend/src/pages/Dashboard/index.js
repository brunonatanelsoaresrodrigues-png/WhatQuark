import React, { useContext } from "react";

import {
  Avatar,
  Box,
  Button,
  Container,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import AssignmentTurnedInOutlinedIcon from "@material-ui/icons/AssignmentTurnedInOutlined";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import HourglassEmptyIcon from "@material-ui/icons/HourglassEmpty";
import LocalHospitalOutlinedIcon from "@material-ui/icons/LocalHospitalOutlined";
import MailOutlineIcon from "@material-ui/icons/MailOutline";
import PhoneInTalkOutlinedIcon from "@material-ui/icons/PhoneInTalkOutlined";
import TrendingUpOutlinedIcon from "@material-ui/icons/TrendingUpOutlined";
import EventAvailableOutlinedIcon from "@material-ui/icons/EventAvailableOutlined";
import ForumOutlinedIcon from "@material-ui/icons/ForumOutlined";
import { useHistory } from "react-router-dom";

import useTickets from "../../hooks/useTickets";
import useWhatsApps from "../../hooks/useWhatsApps";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";
import Chart from "./Chart";
import Skeleton from "@material-ui/lab/Skeleton";

const useStyles = makeStyles(theme => ({
  container: {
    width: "100%",
    maxWidth: 1440,
    paddingTop: theme.spacing(3.5),
    paddingBottom: theme.spacing(5),
    [theme.breakpoints.down("xs")]: { paddingTop: theme.spacing(2) }
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    marginBottom: theme.spacing(3.5),
    padding: theme.spacing(4.5),
    color: "#fff",
    background:
      "linear-gradient(118deg, #0B2742 0%, #0D3458 58%, #11546A 100%)",
    border: 0,
    borderRadius: 20,
    boxShadow: "0 22px 60px rgba(11,39,66,.2)",
    [theme.breakpoints.down("xs")]: { padding: theme.spacing(3, 2.5) },
    "&:before": {
      content: '""',
      position: "absolute",
      width: 260,
      height: 260,
      top: -145,
      right: 80,
      borderRadius: "50%",
      background: "rgba(116,164,255,.12)"
    },
    "&:after": {
      content: '""',
      position: "absolute",
      width: 190,
      height: 190,
      right: -70,
      bottom: -120,
      borderRadius: "50%",
      background: "rgba(54,191,174,.12)"
    }
  },
  heroContent: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2.5),
    [theme.breakpoints.down("xs")]: { alignItems: "flex-start" }
  },
  heroAvatar: {
    width: 64,
    height: 64,
    flex: "0 0 auto",
    color: "#fff",
    background: "linear-gradient(145deg, #36bfae, #3978e6)",
    boxShadow: "0 12px 30px rgba(0,0,0,.2)"
  },
  eyebrow: {
    display: "block",
    marginBottom: theme.spacing(0.8),
    color: "rgba(190,216,255,.78)",
    fontSize: ".66rem",
    fontWeight: 800,
    letterSpacing: ".12em",
    textTransform: "uppercase"
  },
  heroTitle: {
    fontWeight: 800,
    letterSpacing: "-0.025em"
  },
  heroText: {
    maxWidth: 720,
    marginTop: theme.spacing(0.75),
    color: "rgba(255,255,255,.78)"
  },
  metric: {
    height: "100%",
    minHeight: 132,
    padding: theme.spacing(2.4),
    border: `1px solid ${theme.palette.divider}`,
    borderTop: "1px solid var(--metric-color)",
    borderRadius: 16,
    transition: "transform 180ms ease, box-shadow 180ms ease",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: theme.productTokens.shadows.raised
    }
  },
  metricHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1)
  },
  metricIcon: {
    width: 44,
    height: 44,
    color: "var(--metric-color)",
    backgroundColor: "var(--metric-bg)",
    borderRadius: 12
  },
  metricValue: {
    marginTop: theme.spacing(1.2),
    fontWeight: 800,
    letterSpacing: "-.035em",
    color: theme.palette.text.primary
  },
  chartPaper: {
    height: 340,
    padding: theme.spacing(2.75),
    borderRadius: 16
  },
  chartTitle: {
    marginBottom: theme.spacing(1.5)
  },
  overviewPaper: {
    height: 340,
    padding: theme.spacing(2.5),
    display: "flex",
    flexDirection: "column",
    borderRadius: 16
  },
  overviewRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing(1.25, 0)
  },
  progress: {
    height: 8,
    borderRadius: 20,
    marginTop: theme.spacing(0.75),
    marginBottom: theme.spacing(1.5),
    backgroundColor: theme.palette.action.hover
  },
  quickActions: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    marginTop: "auto"
  }
}));

const MetricCard = ({ color, background, icon, label, value }) => {
  const classes = useStyles();
  return (
    <Paper
      className={classes.metric}
      style={{ "--metric-color": color, "--metric-bg": background }}
    >
      <div className={classes.metricHeader}>
        <Typography color="textSecondary" variant="subtitle2">
          {label}
        </Typography>
        <Avatar className={classes.metricIcon}>{icon}</Avatar>
      </div>
      <Typography variant="h3" component="p" className={classes.metricValue}>
        {value}
      </Typography>
    </Paper>
  );
};

const Dashboard = () => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const userQueueIds = (user.queues || []).map(queue => queue.id);
  const queueIds = JSON.stringify(userQueueIds);
  const { count: openCount, loading: loadingOpen } = useTickets({
    status: "open",
    showAll: "true",
    withUnreadMessages: "false",
    queueIds
  });
  const { count: pendingCount, loading: loadingPending } = useTickets({
    status: "pending",
    showAll: "true",
    withUnreadMessages: "false",
    queueIds
  });
  const { count: closedCount, loading: loadingClosed } = useTickets({
    status: "closed",
    showAll: "true",
    withUnreadMessages: "false",
    queueIds
  });
  const { count: unreadCount, loading: loadingUnread } = useTickets({
    showAll: "true",
    withUnreadMessages: "true",
    queueIds
  });
  const { whatsApps } = useWhatsApps();
  const connectedChannels = whatsApps.filter(
    whatsapp => whatsapp.status === "CONNECTED"
  ).length;
  const activeTotal = openCount + pendingCount;
  const completedTotal = activeTotal + closedCount;
  const resolutionRate = completedTotal
    ? Math.round((closedCount / completedTotal) * 100)
    : 0;

  const firstName = (user.name || "Equipe").trim().split(/\s+/)[0];

  return (
    <Container maxWidth="lg" className={classes.container}>
      <Paper className={classes.hero}>
        <div className={classes.heroContent}>
          <Avatar className={classes.heroAvatar}>
            <LocalHospitalOutlinedIcon fontSize="large" />
          </Avatar>
          <Box>
            <span className={classes.eyebrow}>
              Central inteligente de atendimento
            </span>
            <Typography
              variant="h4"
              component="h1"
              className={classes.heroTitle}
            >
              Olá, {firstName}! Bem-vindo(a) ao SquadChat.
            </Typography>
            <Typography variant="body1" className={classes.heroText}>
              Atendimento, WhatsApp e QuarkClinic reunidos em uma experiência
              única para a Essencial Saúde.
            </Typography>
          </Box>
        </div>
      </Paper>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            color="#08766c"
            background="#dff4f0"
            icon={<AssignmentTurnedInOutlinedIcon />}
            label={i18n.t("dashboard.messages.inAttendance.title")}
            value={loadingOpen ? <Skeleton width={60} /> : openCount}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            color="#d58b16"
            background="#fff3da"
            icon={<HourglassEmptyIcon />}
            label={i18n.t("dashboard.messages.waiting.title")}
            value={loadingPending ? <Skeleton width={60} /> : pendingCount}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            color="#348a55"
            background="#e4f4e9"
            icon={<CheckCircleOutlineIcon />}
            label={i18n.t("dashboard.messages.closed.title")}
            value={loadingClosed ? <Skeleton width={60} /> : closedCount}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            color="#c05a69"
            background="#fbe8eb"
            icon={<MailOutlineIcon />}
            label="Mensagens não lidas"
            value={loadingUnread ? <Skeleton width={60} /> : unreadCount}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            color="#1b7f91"
            background="#dff3f6"
            icon={<PhoneInTalkOutlinedIcon />}
            label="Canais conectados"
            value={`${connectedChannels}/${whatsApps.length}`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            color="#7957a5"
            background="#eee7f7"
            icon={<TrendingUpOutlinedIcon />}
            label="Índice de resolução"
            value={`${resolutionRate}%`}
          />
        </Grid>
        <Grid item xs={12} lg={8}>
          <Paper className={classes.chartPaper}>
            <Typography variant="h6" className={classes.chartTitle}>
              Entradas de atendimento hoje
            </Typography>
            <Chart />
          </Paper>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Paper className={classes.overviewPaper}>
            <Typography variant="h6">Resumo operacional</Typography>
            <div className={classes.overviewRow}>
              <Typography color="textSecondary">Carga atual</Typography>
              <Typography variant="h6">{activeTotal} conversas</Typography>
            </div>
            <Divider />
            <div className={classes.overviewRow}>
              <Typography color="textSecondary">Filas acessíveis</Typography>
              <Typography variant="h6">{userQueueIds.length}</Typography>
            </div>
            <Divider />
            <div className={classes.overviewRow}>
              <Typography color="textSecondary">Resolvidas</Typography>
              <Typography variant="h6">{closedCount}</Typography>
            </div>
            <Typography variant="caption" color="textSecondary">
              Proporção de conversas resolvidas no conjunto consultado
            </Typography>
            <LinearProgress
              aria-label="Proporção de conversas resolvidas"
              variant="determinate"
              value={resolutionRate}
              className={classes.progress}
            />
            <div className={classes.quickActions}>
              <Button
                color="primary"
                variant="contained"
                startIcon={<ForumOutlinedIcon />}
                onClick={() => history.push("/tickets")}
              >
                Abrir atendimentos
              </Button>
              {user.profile === "admin" && (
                <Button
                  color="primary"
                  variant="outlined"
                  startIcon={<EventAvailableOutlinedIcon />}
                  onClick={() => history.push("/quark-dashboard")}
                >
                  Consultas Quark
                </Button>
              )}
            </div>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
