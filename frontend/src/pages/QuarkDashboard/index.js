import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
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
import { addDays, format } from "date-fns";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../services/api";
import openSocket from "../../services/socket-io";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
  container: {
    paddingTop: theme.spacing(3),
    paddingBottom: theme.spacing(4)
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
    padding: theme.spacing(2),
    marginBottom: theme.spacing(3)
  },
  filterControl: {
    minWidth: 190
  },
  metric: {
    minHeight: 118,
    padding: theme.spacing(2),
    borderTop: `4px solid ${theme.palette.primary.main}`
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
    marginTop: theme.spacing(3)
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
    whiteSpace: "nowrap"
  }
}));

const isoDate = date => format(date, "yyyy-MM-dd");

const formatDateTime = value => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return format(parsed, "dd/MM/yyyy HH:mm");
};

const formatPhone = value => {
  if (!value) return "Sem telefone";
  const phone = String(value).trim();
  return phone.startsWith("+") ? phone : `+${phone}`;
};

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
  CANCELADO: "Cancelada",
  CANCELADO_VIA_SMS: "Cancelada",
  EXCLUIDO: "Excluída",
  PENDING: "Na fila",
  PROCESSING: "Processando",
  SENT: "Enviada",
  FAILED_RETRY: "Nova tentativa",
  DEAD_LETTER: "Falha",
  SUPPRESSED: "Suprimida"
};

const MetricCard = ({ label, value, color }) => (
  <Paper style={{ borderTopColor: color }}>
    <Box p={2} minHeight={114}>
      <Typography color="textSecondary" variant="body2">
        {label}
      </Typography>
      <Typography variant="h4" style={{ fontWeight: 700, marginTop: 8 }}>
        {value}
      </Typography>
    </Box>
  </Paper>
);

const QuarkDashboard = () => {
  const classes = useStyles();
  const theme = useTheme();
  const history = useHistory();
  const [filters, setFilters] = useState({
    from: isoDate(new Date()),
    to: isoDate(addDays(new Date(), 30)),
    status: ""
  });
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

  const params = useMemo(
    () => ({ from: filters.from, to: filters.to }),
    [filters.from, filters.to]
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryResult, timeseriesResult, breakdownResult, rowsResult] =
        await Promise.all([
          api.get("/quark/dashboard/summary", { params }),
          api.get("/quark/dashboard/timeseries", { params }),
          api.get("/quark/dashboard/breakdown", { params }),
          api.get("/quark/dashboard/appointments", {
            params: {
              ...params,
              status: filters.status || undefined,
              page: page + 1,
              pageSize
            }
          })
        ]);
      setSummary(summaryResult.data);
      setTimeseries(timeseriesResult.data);
      setBreakdown(breakdownResult.data);
      setAppointments(rowsResult.data);
    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false);
    }
  }, [filters.status, page, pageSize, params]);

  useEffect(() => {
    loadDashboard();
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
    setFilters(current => ({ ...current, [name]: value }));
  };

  const sendReminder = async row => {
    setSendingReminder(row.appointmentId);
    try {
      await api.post(
        `/quark/dashboard/appointments/${encodeURIComponent(
          row.appointmentId
        )}/reminder`
      );
      toast.success(
        "Lembrete adicionado à fila. O envio seguirá o intervalo automático."
      );
      await loadDashboard();
    } catch (error) {
      toastError(error);
    } finally {
      setSendingReminder(null);
    }
  };

  const reminderDisabledReason = row => {
    if (row.status !== "AGENDADO") return "A consulta não está agendada.";
    if (!row.phone) return "O paciente não possui telefone válido.";
    const scheduledAt = new Date(row.scheduledAt).getTime();
    if (Number.isNaN(scheduledAt) || scheduledAt <= Date.now()) {
      return "O horário da consulta já passou.";
    }
    if (Number(row.manualReminderToday)) {
      return "Um lembrete manual já foi solicitado hoje.";
    }
    return "";
  };

  if (loading && !summary) {
    return (
      <div className={classes.loading}>
        <CircularProgress />
      </div>
    );
  }

  const notifications = summary?.notifications || {};
  const responses = summary?.responses || {};
  const appointmentMetrics = summary?.appointments || {};

  const metrics = [
    ["Agendas monitoradas", appointmentMetrics.monitored || 0, "#3f51b5"],
    ["Mensagens geradas", notifications.generated || 0, "#607d8b"],
    ["Mensagens enviadas", notifications.sent || 0, "#2196f3"],
    ["Entregues", notifications.delivered || 0, "#00acc1"],
    ["Lidas", notifications.read || 0, "#00897b"],
    ["Aguardando envio", notifications.queued || 0, "#ff9800"],
    ["Aguardando resposta", appointmentMetrics.awaitingResponse || 0, "#f9a825"],
    ["Confirmadas pelo WhatsApp", responses.confirmed || 0, "#43a047"],
    ["Canceladas pelo WhatsApp", responses.cancelled || 0, "#e53935"],
    ["Falhas de envio", notifications.failed || 0, "#b71c1c"],
    ["Taxa de resposta", `${responses.responseRate || 0}%`, "#7e57c2"],
    ["Tempo médio de resposta", formatDuration(responses.averageResponseSeconds), "#5c6bc0"]
  ];

  return (
    <Container maxWidth="xl" className={classes.container}>
      <div className={classes.header}>
        <div>
          <Typography variant="h5">Automação Quark</Typography>
          <Typography variant="body2" className={classes.syncText}>
            Última sincronização: {formatDateTime(summary?.sync?.lastSuccessfulSyncAt)}
          </Typography>
        </div>
        <Button
          variant="contained"
          color="primary"
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
          onClick={loadDashboard}
          disabled={loading}
        >
          Atualizar
        </Button>
      </div>

      <Paper className={classes.filters}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4} md={3}>
            <TextField
              fullWidth
              type="date"
              label="Data inicial"
              name="from"
              value={filters.from}
              onChange={changeFilter}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4} md={3}>
            <TextField
              fullWidth
              type="date"
              label="Data final"
              name="to"
              value={filters.to}
              onChange={changeFilter}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4} md={3}>
            <FormControl fullWidth className={classes.filterControl}>
              <InputLabel>Situação da consulta</InputLabel>
              <Select name="status" value={filters.status} onChange={changeFilter}>
                <MenuItem value="">Todas</MenuItem>
                <MenuItem value="SCHEDULED">Agendadas</MenuItem>
                <MenuItem value="AWAITING_RESPONSE">Aguardando resposta</MenuItem>
                <MenuItem value="CONFIRMED">Confirmadas</MenuItem>
                <MenuItem value="CANCELLED">Canceladas</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={2}>
        {metrics.map(([label, value, color]) => (
          <Grid item xs={12} sm={6} md={3} key={label}>
            <MetricCard label={label} value={value} color={color} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} className={classes.section}>
        <Grid item xs={12} lg={8}>
          <Paper className={classes.chartPaper}>
            <Typography variant="h6">Mensagens e respostas por dia</Typography>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={timeseries} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <ChartTooltip />
                <Legend />
                <Bar dataKey="sent" name="Enviadas" fill={theme.palette.primary.main} />
                <Bar dataKey="delivered" name="Entregues" fill="#00acc1" />
                <Bar dataKey="read" name="Lidas" fill="#00897b" />
                <Bar dataKey="confirmed" name="Confirmadas" fill="#43a047" />
                <Bar dataKey="cancelled" name="Canceladas" fill="#e53935" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Paper className={classes.chartPaper}>
            <Typography variant="h6">Resultado por tipo de mensagem</Typography>
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
                      <TableCell>{notificationLabels[row.eventType] || row.eventType}</TableCell>
                      <TableCell align="right">{Number(row.generated || 0)}</TableCell>
                      <TableCell align="right">{Number(row.sent || 0)}</TableCell>
                      <TableCell align="right">{Number(row.failed || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      <Paper className={classes.section}>
        <Typography variant="h6" className={classes.sectionTitle}>
          Consultas e notificações
        </Typography>
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
                    <Typography variant="caption" color="textSecondary">{formatPhone(row.phone)}</Typography>
                  </TableCell>
                  <TableCell>{formatDateTime(row.scheduledAt)}</TableCell>
                  <TableCell>{row.professional}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      className={classes.statusChip}
                      label={row.awaitingConfirmation ? "Aguardando resposta" : statusLabels[row.status] || row.status}
                      color={row.status === "CONFIRMADO" ? "primary" : "default"}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{notificationLabels[row.lastEventType] || row.lastEventType || "—"}</Typography>
                    <Typography variant="caption" color="textSecondary">{statusLabels[row.lastNotificationStatus] || row.lastNotificationStatus || "Sem envio"}</Typography>
                  </TableCell>
                  <TableCell>
                    {row.lastReadAt ? "Lida" : row.lastDeliveredAt ? "Entregue" : row.lastSentAt ? "Enviada" : "—"}
                  </TableCell>
                  <TableCell>
                    {row.lastDecision === "CONFIRMED"
                      ? "Confirmou"
                      : row.lastDecision === "CANCELLED"
                      ? "Cancelou"
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className={classes.actions}>
                      <Tooltip title={reminderDisabledReason(row) || "Enviar mensagem para confirmar a consulta"}>
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
                              sendingReminder !== null
                            }
                            onClick={() => sendReminder(row)}
                          >
                            {Number(row.manualReminderToday)
                              ? "Solicitado hoje"
                              : "Enviar lembrete"}
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
                  </TableCell>
                </TableRow>
              ))}
              {appointments.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">Nenhuma consulta encontrada no período.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={appointments.total || 0}
          page={page}
          onChangePage={(_, nextPage) => setPage(nextPage)}
          rowsPerPage={pageSize}
          onChangeRowsPerPage={event => {
            setPageSize(Number(event.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="Linhas por página"
        />
      </Paper>

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
                  <TableCell align="right">{Number(row.appointments || 0)}</TableCell>
                  <TableCell align="right">{Number(row.confirmedInQuark || 0)}</TableCell>
                  <TableCell align="right">{Number(row.cancelledInQuark || 0)}</TableCell>
                  <TableCell align="right">{Number(row.awaitingResponse || 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
};

export default QuarkDashboard;
