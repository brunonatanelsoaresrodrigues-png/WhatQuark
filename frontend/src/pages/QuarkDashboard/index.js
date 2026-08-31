import AppointmentCalendar from "./AppointmentCalendar";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef
} from "react";
import {
  Box,
  Collapse,
  useMediaQuery,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import RefreshIcon from "@material-ui/icons/Refresh";
import NotificationsActiveIcon from "@material-ui/icons/NotificationsActive";
import ChatBubbleOutlineIcon from "@material-ui/icons/ChatBubbleOutline";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis
} from "recharts";
import { format } from "date-fns";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import MessagingSafetyPanel from "../../components/MessagingSafetyPanel";
import api from "../../services/api";
import openSocket from "../../services/socket-io";
import toastError from "../../errors/toastError";
import PageHeading from "../../components/PageHeading";
import PageSkeleton from "../../components/PageSkeleton";
import {
  formatQuarkPhone,
  quarkMonthRange
} from "../../services/quarkAgendaDisplay";

const useStyles = makeStyles(theme => ({
  container: {
    padding: theme.spacing(2.5, 3, 4),
    [theme.breakpoints.down("sm")]: { padding: theme.spacing(2) }
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2)
  },
  filters: {
    padding: theme.spacing(1.5, 2),
    marginBottom: theme.spacing(2)
  },
  agendaFilters: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1.5),
    flexWrap: "wrap"
  },
  filterChips: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap"
  },
  filterControl: {
    minWidth: 0
  },
  metric: {
    minHeight: 96,
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    boxShadow: theme.productTokens.shadows.rest
  },
  metricValue: {
    marginTop: theme.spacing(1),
    fontWeight: 700
  },
  chartPaper: {
    height: 360,
    padding: theme.spacing(2)
  },
  section: {
    marginTop: theme.spacing(2)
  },
  sectionTitle: {
    padding: theme.spacing(2),
    paddingBottom: 0
  },
  syncText: {
    color: theme.palette.text.secondary
  },
  loading: {
    minHeight: 320,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  statusChip: {
    fontWeight: 600
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap"
  },
  compactActions: {
    marginTop: theme.spacing(1),
    "& .MuiButton-root": {
      minWidth: 0,
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1)
    }
  },
  calendarPaper: {
    overflow: "hidden",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 14,
    boxShadow: theme.productTokens.shadows.rest
  },
  dayPaper: {
    height: "100%",
    minHeight: 520,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 14,
    boxShadow: theme.productTokens.shadows.rest
  },
  dayHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`
  },
  dayTitle: {
    fontWeight: 700,
    letterSpacing: "-.015em"
  },
  dayList: {
    flex: 1,
    minHeight: 0,
    maxHeight: 480,
    overflowY: "auto",
    padding: theme.spacing(1.5)
  },
  appointmentCard: {
    display: "grid",
    gridTemplateColumns: "54px minmax(0, 1fr)",
    gap: theme.spacing(1.25),
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    backgroundColor: theme.palette.background.paper,
    "&:last-child": { marginBottom: 0 }
  },
  appointmentTime: {
    fontSize: 16,
    fontWeight: 750,
    color: theme.palette.primary.main,
    letterSpacing: "-.02em"
  },
  appointmentName: {
    minWidth: 0,
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  appointmentTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1)
  },
  appointmentMeta: {
    marginTop: 3,
    color: theme.palette.text.secondary,
    fontSize: 12,
    lineHeight: 1.45
  },
  emptyDay: {
    minHeight: 260,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: theme.spacing(3),
    color: theme.palette.text.secondary
  }
}));

const isoDate = date => format(date, "yyyy-MM-dd");

const formatDateTime = value => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return format(parsed, "dd/MM/yyyy HH:mm");
};

const formatTime = value => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : format(parsed, "HH:mm");
};

const formatSelectedDay = value =>
  new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long"
  });

const formatDuration = seconds => {
  const value = Number(seconds || 0);
  if (!value) return "—";
  if (value < 60) return `${value}s`;
  if (value < 3600) return `${Math.round(value / 60)}min`;
  return `${(value / 3600).toFixed(1)}h`;
};

const notificationLabels = {
  CREATED: "Novo agendamento",
  REMINDER: "Lembrete",
  RESCHEDULED: "Alteração",
  UPDATED: "Atualização",
  CANCELLED: "Cancelamento",
  MANUAL_REMINDER: "Lembrete manual"
};

const statusLabels = {
  AGENDADO: "Agendada",
  CONFIRMADO: "Confirmada",
  CONFIRMING: "Confirmando no Quark",
  CANCELADO: "Cancelada",
  CANCELADO_VIA_SMS: "Cancelada",
  EXCLUIDO: "Excluída",
  PENDING: "Na fila",
  PROCESSING: "Processando",
  SENT: "Enviada",
  FAILED_RETRY: "Nova tentativa",
  DEAD_LETTER: "Falha",
  UNKNOWN: "Conferir resultado",
  SUPPRESSED: "Suprimida"
};

const MetricCard = ({ label, value, color }) => (
  <Paper
    variant="outlined"
    style={{ borderTop: `3px solid ${color}`, borderRadius: 12 }}
  >
    <Box p={1.5} minHeight={82}>
      <Typography color="textSecondary" variant="body2">
        {label}
      </Typography>
      <Typography variant="h5" style={{ fontWeight: 700, marginTop: 4 }}>
        {value}
      </Typography>
    </Box>
  </Paper>
);

const QuarkDashboard = () => {
  const classes = useStyles();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [advancedFilters, setAdvancedFilters] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const history = useHistory();
  const [filters, setFilters] = useState({
    ...quarkMonthRange(),
    status: "",
    messageStatus: "",
    responseStatus: ""
  });
  const [section, setSection] = useState("calendar");
  const [calendarDays, setCalendarDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState(isoDate(new Date()));
  const [preview, setPreview] = useState(null);
  const generation = useRef(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [summary, setSummary] = useState(null);
  const [timeseries, setTimeseries] = useState([]);
  const [breakdown, setBreakdown] = useState({
    eventTypes: [],
    professionals: []
  });
  const [appointments, setAppointments] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [sendingReminder, setSendingReminder] = useState(null);
  const [confirmingAppointment, setConfirmingAppointment] = useState(null);

  const params = useMemo(
    () => ({ from: filters.from, to: filters.to }),
    [filters.from, filters.to]
  );

  const loadDashboard = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    try {
      const [
        summaryResult,
        timeseriesResult,
        breakdownResult,
        rowsResult,
        calendarResult
      ] = await Promise.all([
        api.get("/quark/dashboard/summary", { params }),
        section === "analytics"
          ? api.get("/quark/dashboard/timeseries", { params })
          : Promise.resolve({ data: [] }),
        section === "analytics"
          ? api.get("/quark/dashboard/breakdown", { params })
          : Promise.resolve({ data: { eventTypes: [], professionals: [] } }),
        api.get("/quark/dashboard/appointments", {
          params: {
            ...(section === "calendar"
              ? { from: selectedDay, to: selectedDay }
              : params),
            status: filters.status || undefined,
            messageStatus: filters.messageStatus || undefined,
            responseStatus: filters.responseStatus || undefined,
            page: page + 1,
            pageSize
          }
        }),
        section === "calendar"
          ? api.get("/quark/dashboard/calendar-days", {
              params: {
                ...params,
                status: filters.status || undefined,
                messageStatus: filters.messageStatus || undefined,
                responseStatus: filters.responseStatus || undefined
              }
            })
          : Promise.resolve({ data: [] })
      ]);
      if (current !== generation.current) return;
      setSummary(summaryResult.data);
      setTimeseries(timeseriesResult.data);
      setBreakdown(breakdownResult.data);
      setAppointments(rowsResult.data);
      setCalendarDays(calendarResult.data);
    } catch (error) {
      if (current === generation.current) toastError(error);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [
    section,
    selectedDay,
    filters.messageStatus,
    filters.responseStatus,
    filters.status,
    page,
    pageSize,
    params
  ]);

  useEffect(() => {
    loadDashboard();
    return () => {
      generation.current += 1;
    };
  }, [loadDashboard]);

  useEffect(() => {
    const socket = openSocket();
    let timer;
    socket.on("quarkDashboard", () => {
      clearTimeout(timer);
      timer = setTimeout(loadDashboard, 700);
    });
    return () => {
      clearTimeout(timer);
      socket.disconnect();
    };
  }, [loadDashboard]);

  const changeFilter = event => {
    const { name, value } = event.target;
    setPage(0);
    if ((name === "from" || name === "to") && !value) return;
    setFilters(current => {
      const next = { ...current, [name]: value };
      if (next.from > next.to) next[name === "from" ? "to" : "from"] = value;
      if (selectedDay < next.from || selectedDay > next.to)
        setSelectedDay(next.from);
      return next;
    });
  };

  const requestReminder = async row => {
    try {
      const { data } = await api.get(
        `/quark/dashboard/appointments/${encodeURIComponent(
          row.appointmentId
        )}/reminder-preview`
      );
      setPreview({ ...data, row });
    } catch (e) {
      toastError(e);
    }
  };
  const sendReminder = async row => {
    setSendingReminder(row.appointmentId);
    try {
      const { data } = await api.post(
        `/quark/dashboard/appointments/${encodeURIComponent(
          row.appointmentId
        )}/reminder`,
        { fingerprint: preview?.fingerprint, phone: preview?.phone }
      );
      toast.success(
        Number(data?.recipients) > 1
          ? `Lembretes adicionados à fila para ${data.recipients} números. Os envios seguirão o intervalo automático.`
          : "Lembrete adicionado à fila. O envio seguirá o intervalo automático."
      );
      setPreview(null);
      await loadDashboard();
    } catch (error) {
      toastError(error);
    } finally {
      setSendingReminder(null);
    }
  };

  const reminderDisabledReason = row => {
    if (["UNKNOWN", "PROCESSING"].includes(row.lastDecisionStatus))
      return "Confira a alteração anterior antes de continuar.";
    if (row.status !== "AGENDADO") return "A consulta não está agendada.";
    if (!(row.phones || []).length && !row.phone) {
      return "O paciente não possui telefone válido.";
    }
    const scheduledAt = new Date(row.scheduledAt).getTime();
    if (Number.isNaN(scheduledAt) || scheduledAt <= Date.now()) {
      return "O horário da consulta já passou.";
    }
    if (Number(row.manualReminderToday)) {
      return "Um lembrete manual já foi solicitado hoje.";
    }
    return "";
  };

  const confirmDisabledReason = row => {
    if (row.status === "CONFIRMADO") return "A consulta já está confirmada.";
    if (["UNKNOWN", "PROCESSING"].includes(row.lastDecisionStatus))
      return "Confira a alteração anterior antes de continuar.";
    if (row.status !== "AGENDADO") return "A consulta não está agendada.";
    const scheduledAt = new Date(row.scheduledAt).getTime();
    if (Number.isNaN(scheduledAt) || scheduledAt <= Date.now()) {
      return "O horário da consulta já passou.";
    }
    return "";
  };

  const confirmAppointment = async row => {
    setConfirmingAppointment(row.appointmentId);
    try {
      await api.post(
        `/quark/dashboard/appointments/${encodeURIComponent(
          row.appointmentId
        )}/confirm`
      );
      toast.success("Consulta confirmada com sucesso no Quark.");
      setConfirmation(null);
      await loadDashboard();
    } catch (error) {
      toastError(error);
    } finally {
      setConfirmingAppointment(null);
    }
  };

  const renderActions = (row, compact = false) => (
    <div
      className={`${classes.actions} ${
        compact ? classes.compactActions : ""
      }`}
    >
      {["UNKNOWN", "PROCESSING"].includes(row.lastDecisionStatus) && (
        <Button
          size="small"
          onClick={async () => {
            try {
              await api.post(
                `/quark/dashboard/appointments/${encodeURIComponent(
                  row.appointmentId
                )}/reconcile`
              );
              await loadDashboard();
            } catch (e) {
              toastError(e);
            }
          }}
        >
          Conferir no Quark
        </Button>
      )}
      <Tooltip
        title={
          reminderDisabledReason(row) ||
          "Enviar mensagem para confirmar a consulta"
        }
      >
        <span>
          <Button
            size="small"
            variant="outlined"
            color="primary"
            startIcon={
              sendingReminder === row.appointmentId ? (
                <CircularProgress size={16} />
              ) : (
                <NotificationsActiveIcon />
              )
            }
            disabled={
              Boolean(reminderDisabledReason(row)) ||
              sendingReminder !== null ||
              confirmingAppointment !== null
            }
            onClick={() => requestReminder(row)}
          >
            {Number(row.manualReminderToday)
              ? "Solicitado hoje"
              : compact
              ? "Lembrete"
              : "Enviar lembrete"}
          </Button>
        </span>
      </Tooltip>
      <Tooltip
        title={
          confirmDisabledReason(row) ||
          "Confirmar esta consulta diretamente no Quark"
        }
      >
        <span>
          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={
              confirmingAppointment === row.appointmentId ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <CheckCircleOutlineIcon />
              )
            }
            disabled={
              Boolean(confirmDisabledReason(row)) ||
              confirmingAppointment !== null ||
              sendingReminder !== null
            }
            onClick={() => setConfirmation(row)}
          >
            {compact ? "Confirmar" : "Confirmar no Quark"}
          </Button>
        </span>
      </Tooltip>
      {row.ticketId && (
        <Tooltip title="Abrir a conversa deste paciente">
          <Button
            size="small"
            variant="outlined"
            startIcon={<ChatBubbleOutlineIcon />}
            onClick={() => history.push(`/tickets/${row.ticketId}`)}
          >
            Conversa
          </Button>
        </Tooltip>
      )}
    </div>
  );

  if (loading && !summary) {
    return <PageSkeleton />;
  }

  const notifications = summary?.notifications || {};
  const responses = summary?.responses || {};
  const appointmentMetrics = summary?.appointments || {};
  const selectedDayMetrics =
    calendarDays.find(item => item.day === selectedDay) || {};

  // Acentos vindos da paleta da marca; os estados com significado proprio
  // (confirmado, cancelado, aguardando) usam os tokens de status.
  const accent = index => theme.chartPalette[index % theme.chartPalette.length];
  const status = theme.statusTokens;
  const metrics = [
    ["Agendas monitoradas", appointmentMetrics.monitored || 0, accent(1)],
    ["Mensagens geradas", notifications.generated || 0, status.neutral.fg],
    ["Mensagens enviadas", notifications.sent || 0, accent(6)],
    ["Entregues", notifications.delivered || 0, accent(0)],
    ["Lidas", notifications.read || 0, accent(7)],
    ["Aguardando envio", notifications.queued || 0, status.warning.fg],
    [
      "Aguardando resposta",
      appointmentMetrics.awaitingResponse || 0,
      accent(2)
    ],
    ["Confirmadas pelo WhatsApp", responses.confirmed || 0, status.success.fg],
    ["Canceladas pelo WhatsApp", responses.cancelled || 0, status.danger.fg],
    ["Falhas de envio", notifications.failed || 0, status.danger.fg],
    ["Taxa de resposta", `${responses.responseRate || 0}%`, accent(3)],
    [
      "Tempo médio de resposta",
      formatDuration(responses.averageResponseSeconds),
      accent(5)
    ]
  ];
  const calendarMetrics = [
    ["Consultas no dia", selectedDayMetrics.total || 0, accent(0)],
    ["Confirmadas", selectedDayMetrics.confirmed || 0, status.success.fg],
    [
      "Aguardando resposta",
      selectedDayMetrics.awaitingResponse || 0,
      status.warning.fg
    ],
    ["Canceladas", selectedDayMetrics.cancelled || 0, status.danger.fg]
  ];

  return (
    <Container maxWidth="xl" className={classes.container}>
      <PageHeading
        title="Agenda Quark"
        eyebrow="Operação clínica"
        description={`Consultas, confirmações e avisos · Sincronizado em ${formatDateTime(
          summary?.sync?.lastSuccessfulSyncAt
        )}`}
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={
              loading ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <RefreshIcon />
              )
            }
            onClick={loadDashboard}
            disabled={loading}
          >
            Atualizar
          </Button>
        }
      />

      <MessagingSafetyPanel compact />
      <Tabs
        value={section}
        variant="scrollable"
        scrollButtons="auto"
        onChange={(_, value) => {
          setSection(value);
          setPage(0);
        }}
        indicatorColor="primary"
        textColor="primary"
        aria-label="Áreas do painel Quark"
        style={{ marginBottom: 16 }}
      >
        <Tab disableRipple value="calendar" label="Agenda" />
        <Tab
          disableRipple
          value="operations"
          label="Consultas e pendências"
        />
        <Tab disableRipple value="analytics" label="Indicadores" />
      </Tabs>
      <Paper className={classes.filters}>
        {section === "calendar" ? (
          <div className={classes.agendaFilters}>
            <div className={classes.filterChips}>
              <Typography variant="body2" color="textSecondary">
                Exibir
              </Typography>
              {[
                ["", "Todas"],
                ["SCHEDULED", "Agendadas"],
                ["AWAITING_RESPONSE", "Aguardando"],
                ["CONFIRMED", "Confirmadas"],
                ["CANCELLED", "Canceladas"]
              ].map(([value, label]) => (
                <Chip
                  key={label}
                  size="small"
                  clickable
                  color={filters.status === value ? "primary" : "default"}
                  variant={filters.status === value ? "default" : "outlined"}
                  label={label}
                  onClick={() => {
                    setPage(0);
                    setFilters(current => ({ ...current, status: value }));
                  }}
                />
              ))}
            </div>
            <Button
              size="small"
              aria-expanded={advancedFilters}
              onClick={() => setAdvancedFilters(value => !value)}
            >
              {advancedFilters ? "Ocultar filtros" : "Filtrar mensagens"}
              {[filters.messageStatus, filters.responseStatus].filter(Boolean)
                .length
                ? ` · ${
                    [filters.messageStatus, filters.responseStatus].filter(
                      Boolean
                    ).length
                  } ativos`
                : ""}
            </Button>
          </div>
        ) : (
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={6} sm={4} md={3}>
              <TextField
                fullWidth
                type="date"
                label="Data inicial"
                id="quark-date-from"
                name="from"
                value={filters.from}
                onChange={changeFilter}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={3}>
              <TextField
                fullWidth
                type="date"
                label="Data final"
                id="quark-date-to"
                name="to"
                value={filters.to}
                onChange={changeFilter}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            {section === "operations" && (
              <Grid item xs={12} sm={4} md={6}>
                <Button
                  aria-expanded={advancedFilters}
                  onClick={() => setAdvancedFilters(v => !v)}
                >
                  {advancedFilters ? "Menos filtros" : "Mais filtros"}
                  {[
                    filters.status,
                    filters.messageStatus,
                    filters.responseStatus
                  ].filter(Boolean).length
                    ? ` · ${
                        [
                          filters.status,
                          filters.messageStatus,
                          filters.responseStatus
                        ].filter(Boolean).length
                      } ativos`
                    : ""}
                </Button>
              </Grid>
            )}
          </Grid>
        )}
        <Collapse in={section !== "analytics" && advancedFilters}>
          <Grid container spacing={2} style={{ paddingTop: 16 }}>
            {section === "operations" && (
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth className={classes.filterControl}>
                  <InputLabel id="quark-status-label">
                    Situação da consulta
                  </InputLabel>
                  <Select
                    labelId="quark-status-label"
                    name="status"
                    value={filters.status}
                    onChange={changeFilter}
                  >
                    <MenuItem value="">Todas</MenuItem>
                    <MenuItem value="SCHEDULED">Agendadas</MenuItem>
                    <MenuItem value="AWAITING_RESPONSE">
                      Aguardando resposta
                    </MenuItem>
                    <MenuItem value="CONFIRMED">Confirmadas</MenuItem>
                    <MenuItem value="CANCELLED">Canceladas</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12} sm={section === "calendar" ? 6 : 4}>
              <FormControl fullWidth className={classes.filterControl}>
                <InputLabel id="quark-messageStatus-label">
                  Situação da mensagem
                </InputLabel>
                <Select
                  labelId="quark-messageStatus-label"
                  name="messageStatus"
                  value={filters.messageStatus}
                  onChange={changeFilter}
                >
                  <MenuItem value="">Todas</MenuItem>
                  <MenuItem value="NO_MESSAGE">Sem envio</MenuItem>
                  <MenuItem value="QUEUED">Na fila ou processando</MenuItem>
                  <MenuItem value="SENT">Enviada</MenuItem>
                  <MenuItem value="DELIVERED">Entregue</MenuItem>
                  <MenuItem value="READ">Lida</MenuItem>
                  <MenuItem value="REMINDER_SENT">Lembrete enviado</MenuItem>
                  <MenuItem value="FAILED">Com falha</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={section === "calendar" ? 6 : 4}>
              <FormControl fullWidth className={classes.filterControl}>
                <InputLabel id="quark-responseStatus-label">
                  Situação da resposta
                </InputLabel>
                <Select
                  labelId="quark-responseStatus-label"
                  name="responseStatus"
                  value={filters.responseStatus}
                  onChange={changeFilter}
                >
                  <MenuItem value="">Todas</MenuItem>
                  <MenuItem value="AWAITING">Aguardando resposta</MenuItem>
                  <MenuItem value="CONFIRMED">Confirmada</MenuItem>
                  <MenuItem value="CANCELLED">Cancelou</MenuItem>
                  <MenuItem value="NO_RESPONSE">Sem resposta</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Collapse>
      </Paper>

      <Grid container spacing={2}>
        {(section === "calendar"
          ? calendarMetrics
          : section === "analytics"
          ? metrics
          : [metrics[0], metrics[6], metrics[5], metrics[9]]
        ).map(([label, value, color]) => (
          <Grid
            item
            xs={6}
            sm={6}
            md={section === "analytics" ? 4 : 3}
            key={label}
          >
            <MetricCard label={label} value={value} color={color} />
          </Grid>
        ))}
      </Grid>

      {section === "analytics" && (
        <Grid container spacing={3} className={classes.section}>
          <Grid item xs={12} lg={8}>
            <Paper className={classes.chartPaper}>
              <Typography variant="h6">
                Mensagens e respostas por dia
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart
                  data={timeseries}
                  margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip />
                  <Legend />
                  <Bar
                    dataKey="sent"
                    name="Enviadas"
                    fill={theme.palette.primary.main}
                  />
                  <Bar dataKey="delivered" name="Entregues" fill={accent(0)} />
                  <Bar dataKey="read" name="Lidas" fill={accent(7)} />
                  <Bar
                    dataKey="confirmed"
                    name="Confirmadas"
                    fill={status.success.fg}
                  />
                  <Bar
                    dataKey="cancelled"
                    name="Canceladas"
                    fill={status.danger.fg}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} lg={4}>
            <Paper className={classes.chartPaper}>
              <Typography variant="h6">
                Resultado por tipo de mensagem
              </Typography>
              <TableContainer style={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Tipo</TableCell>
                      <TableCell align="right">Geradas</TableCell>
                      <TableCell align="right">Enviadas</TableCell>
                      <TableCell align="right">Falhas</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {breakdown.eventTypes.map(row => (
                      <TableRow key={row.eventType}>
                        <TableCell>
                          {notificationLabels[row.eventType] || row.eventType}
                        </TableCell>
                        <TableCell align="right">
                          {Number(row.generated || 0)}
                        </TableCell>
                        <TableCell align="right">
                          {Number(row.sent || 0)}
                        </TableCell>
                        <TableCell align="right">
                          {Number(row.failed || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {section === "calendar" && (
        <Grid container spacing={2} className={classes.section} alignItems="stretch">
          <Grid item xs={12} lg={7}>
            <Paper className={classes.calendarPaper} variant="outlined">
              <AppointmentCalendar
                days={calendarDays}
                from={filters.from}
                to={filters.to}
                selected={selectedDay}
                loading={loading}
                onSelect={day => {
                  setSelectedDay(day);
                  setPage(0);
                }}
                onMonth={direction => {
                  const month = new Date(`${filters.from}T12:00:00`);
                  month.setMonth(month.getMonth() + direction, 1);
                  const from = isoDate(month),
                    to = isoDate(
                      new Date(month.getFullYear(), month.getMonth() + 1, 0)
                    );
                  setFilters(current => ({ ...current, from, to }));
                  setSelectedDay(from);
                  setPage(0);
                }}
                onToday={() => {
                  const today = new Date(),
                    from = isoDate(
                      new Date(today.getFullYear(), today.getMonth(), 1)
                    ),
                    to = isoDate(
                      new Date(today.getFullYear(), today.getMonth() + 1, 0)
                    );
                  setFilters(current => ({ ...current, from, to }));
                  setSelectedDay(isoDate(today));
                  setPage(0);
                }}
              />
            </Paper>
          </Grid>
          <Grid item xs={12} lg={5}>
            <Paper className={classes.dayPaper} variant="outlined">
              <div className={classes.dayHeader}>
                <Box minWidth={0}>
                  <Typography variant="h6" className={classes.dayTitle}>
                    {formatSelectedDay(selectedDay)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Ordem cronológica · atualização automática
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  color="primary"
                  label={`${appointments.total || 0} consulta${
                    appointments.total === 1 ? "" : "s"
                  }`}
                />
              </div>
              <div className={classes.dayList} aria-busy={loading}>
                {appointments.rows.map(row => (
                  <div key={row.id} className={classes.appointmentCard}>
                    <div className={classes.appointmentTime}>
                      {formatTime(row.scheduledAt)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className={classes.appointmentTop}>
                        <Typography
                          variant="body2"
                          className={classes.appointmentName}
                        >
                          {row.patient}
                        </Typography>
                        <Chip
                          size="small"
                          className={classes.statusChip}
                          color={
                            row.status === "CONFIRMADO" ? "primary" : "default"
                          }
                          label={
                            row.awaitingConfirmation
                              ? "Aguardando"
                              : statusLabels[row.status] || row.status
                          }
                        />
                      </div>
                      <div className={classes.appointmentMeta}>
                        {row.professional || "Equipe da clínica"} ·{" "}
                        {formatQuarkPhone(row.phone)}
                      </div>
                      <div className={classes.appointmentMeta}>
                        {row.lastReadAt
                          ? "Mensagem lida"
                          : row.lastDeliveredAt
                          ? "Mensagem entregue"
                          : row.lastSentAt
                          ? "Mensagem enviada"
                          : "Nenhuma mensagem enviada"}
                        {row.lastDecision === "CONFIRMED"
                          ? " · paciente confirmou"
                          : row.lastDecision === "CANCELLED"
                          ? " · paciente cancelou"
                          : row.lastDecisionStatus === "UNKNOWN"
                          ? " · conferir alteração"
                          : ""}
                      </div>
                      {renderActions(row, true)}
                    </div>
                  </div>
                ))}
                {!appointments.rows.length && (
                  <div className={classes.emptyDay}>
                    <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
                      Nenhuma consulta neste dia
                    </Typography>
                    <Typography variant="body2">
                      Selecione outra data no calendário ou ajuste os filtros.
                    </Typography>
                  </div>
                )}
              </div>
              {appointments.total > pageSize && (
                <TablePagination
                  component="div"
                  count={appointments.total || 0}
                  page={page}
                  onPageChange={(_, nextPage) => setPage(nextPage)}
                  rowsPerPage={pageSize}
                  onRowsPerPageChange={event => {
                    setPageSize(Number(event.target.value));
                    setPage(0);
                  }}
                  rowsPerPageOptions={[10, 25, 50]}
                  labelRowsPerPage="Por página"
                />
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {section === "operations" && (
        <Paper className={classes.section}>
          <Typography variant="h6" className={classes.sectionTitle}>
            Consultas e notificações
          </Typography>
          {mobile ? (
            <Box p={2}>
              {appointments.rows.map(row => (
                <Box
                  key={row.id}
                  pb={2}
                  mb={2}
                  style={{ borderBottom: `1px solid ${theme.palette.divider}` }}
                >
                  <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
                    {row.patient}
                  </Typography>
                  <Typography variant="body2">
                    {formatDateTime(row.scheduledAt)} ·{" "}
                    {row.professional || "Equipe da clínica"}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    display="block"
                  >
                    {formatQuarkPhone(row.phone)}
                  </Typography>
                  <Box my={1}>
                    <Chip
                      size="small"
                      color={
                        row.status === "CONFIRMADO" ? "primary" : "default"
                      }
                      label={
                        row.awaitingConfirmation
                          ? "Aguardando resposta"
                          : statusLabels[row.status] || row.status
                      }
                    />
                  </Box>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    style={{ marginBottom: 12 }}
                  >
                    {statusLabels[row.lastNotificationStatus] || "Sem envio"}
                    {["UNKNOWN", "PROCESSING"].includes(row.lastDecisionStatus)
                      ? " · conferir alteração no Quark"
                      : row.lastDecisionStatus === "FAILED"
                      ? " · alteração não concluída"
                      : ""}
                  </Typography>
                  {renderActions(row)}
                </Box>
              ))}
              {!appointments.rows.length && (
                <Typography>Nenhuma consulta encontrada no período.</Typography>
              )}
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Paciente</TableCell>
                    <TableCell>Consulta</TableCell>
                    <TableCell>Profissional</TableCell>
                    <TableCell>Estado no Quark</TableCell>
                    <TableCell>Última mensagem</TableCell>
                    <TableCell>Entrega</TableCell>
                    <TableCell>Resposta</TableCell>
                    <TableCell>Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {appointments.rows.map(row => (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        <Typography variant="body2">{row.patient}</Typography>
                        {(row.phones?.length ? row.phones : [row.phone])
                          .filter(Boolean)
                          .map((phone, index) => (
                            <Typography
                              key={phone}
                              variant="caption"
                              color="textSecondary"
                              display="block"
                            >
                              {index === 0
                                ? "Principal"
                                : `Alternativo ${index}`}
                              : {formatQuarkPhone(phone)}
                            </Typography>
                          ))}
                      </TableCell>
                      <TableCell>{formatDateTime(row.scheduledAt)}</TableCell>
                      <TableCell>{row.professional}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          className={classes.statusChip}
                          label={
                            row.awaitingConfirmation
                              ? "Aguardando resposta"
                              : statusLabels[row.status] || row.status
                          }
                          color={
                            row.status === "CONFIRMADO" ? "primary" : "default"
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {notificationLabels[row.lastEventType] ||
                            row.lastEventType ||
                            "—"}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {statusLabels[row.lastNotificationStatus] ||
                            row.lastNotificationStatus ||
                            "Sem envio"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {row.lastReadAt
                          ? "Lida"
                          : row.lastDeliveredAt
                          ? "Entregue"
                          : row.lastSentAt
                          ? "Enviada"
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {row.lastDecisionStatus === "UNKNOWN"
                          ? "Conferir resultado"
                          : row.lastDecisionStatus === "PROCESSING"
                          ? "Em processamento"
                          : row.lastDecisionStatus === "FAILED"
                          ? "Alteração não concluída"
                          : row.lastDecision === "CONFIRMED"
                          ? row.lastDecisionSource === "DASHBOARD"
                            ? "Confirmada pela equipe"
                            : "Confirmou"
                          : row.lastDecision === "CANCELLED"
                          ? "Cancelou"
                          : "—"}
                      </TableCell>
                      <TableCell>{renderActions(row)}</TableCell>
                    </TableRow>
                  ))}
                  {appointments.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        Nenhuma consulta encontrada no período.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <TablePagination
            component="div"
            count={appointments.total || 0}
            page={page}
            onPageChange={(_, nextPage) => setPage(nextPage)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={event => {
              setPageSize(Number(event.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage={mobile ? "Por página" : "Linhas por página"}
          />
        </Paper>
      )}

      {section === "analytics" && (
        <Paper className={classes.section}>
          <Typography variant="h6" className={classes.sectionTitle}>
            Consultas por profissional
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Profissional</TableCell>
                  <TableCell align="right">Consultas</TableCell>
                  <TableCell align="right">Confirmadas no Quark</TableCell>
                  <TableCell align="right">Canceladas</TableCell>
                  <TableCell align="right">Aguardando resposta</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {breakdown.professionals.map(row => (
                  <TableRow key={row.professional}>
                    <TableCell>{row.professional}</TableCell>
                    <TableCell align="right">
                      {Number(row.appointments || 0)}
                    </TableCell>
                    <TableCell align="right">
                      {Number(row.confirmedInQuark || 0)}
                    </TableCell>
                    <TableCell align="right">
                      {Number(row.cancelledInQuark || 0)}
                    </TableCell>
                    <TableCell align="right">
                      {Number(row.awaitingResponse || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
      <Dialog
        open={!!confirmation}
        onClose={() => !confirmingAppointment && setConfirmation(null)}
        maxWidth="xs"
        fullWidth
        aria-labelledby="quark-confirm-title"
      >
        <DialogTitle id="quark-confirm-title">
          Confirmar consulta no Quark?
        </DialogTitle>
        <DialogContent dividers>
          <Typography paragraph>{confirmation?.patient}</Typography>
          <Typography>{formatDateTime(confirmation?.scheduledAt)}</Typography>
          <Typography
            variant="body2"
            color="textSecondary"
            style={{ marginTop: 12 }}
          >
            Esta ação altera a agenda. O estado da consulta será conferido
            novamente antes de confirmar.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={!!confirmingAppointment}
            onClick={() => setConfirmation(null)}
          >
            Voltar
          </Button>
          <Button
            color="primary"
            variant="contained"
            disabled={!!confirmingAppointment}
            onClick={() => confirmAppointment(confirmation)}
          >
            {confirmingAppointment ? "Confirmando…" : "Confirmar consulta"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!preview}
        onClose={() => setPreview(null)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="reminder-preview-title"
      >
        <DialogTitle id="reminder-preview-title">Revisar lembrete</DialogTitle>
        <DialogContent dividers>
          <Typography paragraph>
            Destinatário: {preview?.phone} · apenas o número principal
          </Typography>
          <Typography variant="body2" style={{ whiteSpace: "pre-wrap" }}>
            {preview?.body}
          </Typography>
          <Typography
            color="textSecondary"
            variant="caption"
            display="block"
            style={{ marginTop: 16 }}
          >
            Autorização, horário e estado da consulta serão verificados
            novamente antes do envio.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreview(null)}>Voltar</Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!!sendingReminder}
            onClick={() => sendReminder(preview.row)}
          >
            Adicionar à fila
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default QuarkDashboard;
