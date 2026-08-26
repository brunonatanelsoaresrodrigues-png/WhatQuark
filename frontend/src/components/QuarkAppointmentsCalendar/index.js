import React, { useMemo } from "react";
import {
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  IconButton,
  TablePagination,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { fade, makeStyles } from "@material-ui/core/styles";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import ChevronRightIcon from "@material-ui/icons/ChevronRight";
import TodayIcon from "@material-ui/icons/Today";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import ptBR from "date-fns/locale/pt-BR";

const useStyles = makeStyles((theme) => ({
  calendar: {
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
    background: fade(theme.palette.primary.main, 0.06),
  },
  monthControls: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
  },
  monthTitle: {
    minWidth: 175,
    textTransform: "capitalize",
    fontWeight: 600,
  },
  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1, 2),
    color: theme.palette.text.secondary,
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  legendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
    flex: "none",
  },
  scheduled: { background: "#1e88e5" },
  waiting: { background: "#f0a000" },
  confirmed: { background: "#249457" },
  cancelled: { background: "#d84b4b" },
  weekdays: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    background: theme.palette.background.default,
    borderTop: `1px solid ${theme.palette.divider}`,
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  weekday: {
    padding: theme.spacing(1),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
  week: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  },
  day: {
    minHeight: 82,
    padding: theme.spacing(1),
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "flex-start",
    textAlign: "left",
    borderRight: `1px solid ${theme.palette.divider}`,
    borderBottom: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
    color: theme.palette.text.primary,
    "&:hover": {
      background: fade(theme.palette.primary.main, 0.07),
    },
    "&:disabled": {
      color: theme.palette.text.disabled,
      background: fade(theme.palette.background.default, 0.65),
    },
  },
  selectedDay: {
    background: `${fade(theme.palette.primary.main, 0.14)} !important`,
    boxShadow: `inset 0 0 0 2px ${theme.palette.primary.main}`,
  },
  dayNumber: {
    fontWeight: 600,
  },
  todayNumber: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
  dayTotal: {
    marginTop: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
  bars: {
    display: "flex",
    gap: 3,
    marginTop: "auto",
    paddingTop: theme.spacing(0.75),
  },
  bar: {
    height: 4,
    minWidth: 5,
    flex: 1,
    borderRadius: 3,
  },
  expansion: {
    gridColumn: "1 / -1",
    padding: theme.spacing(1.5, 2, 2),
    background: fade(theme.palette.primary.main, 0.055),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  expansionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  appointmentList: {
    display: "grid",
    gap: theme.spacing(0.75),
  },
  appointment: {
    display: "grid",
    gridTemplateColumns:
      "70px minmax(150px, 1.2fr) minmax(145px, 1fr) minmax(130px, .8fr) auto",
    gap: theme.spacing(1),
    alignItems: "center",
    padding: theme.spacing(1),
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 7,
  },
  appointmentTime: {
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  secondary: {
    color: theme.palette.text.secondary,
  },
  loading: {
    minHeight: 100,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  empty: {
    padding: theme.spacing(3),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
  pagination: {
    marginTop: theme.spacing(0.5),
  },
  "@media (max-width: 960px)": {
    appointment: {
      gridTemplateColumns: "62px minmax(0, 1fr)",
      "& > *:nth-child(n+3)": {
        gridColumn: 2,
      },
    },
  },
  "@media (max-width: 600px)": {
    toolbar: {
      alignItems: "flex-start",
    },
    monthTitle: {
      minWidth: 130,
    },
    weekday: {
      padding: theme.spacing(0.75, 0.25),
    },
    day: {
      minHeight: 58,
      padding: theme.spacing(0.5),
    },
    dayTotal: {
      display: "none",
    },
    expansion: {
      padding: theme.spacing(1),
    },
  },
}));

const dayKey = (date) => format(date, "yyyy-MM-dd");

const QuarkAppointmentsCalendar = ({
  calendarDays,
  visibleMonth,
  rangeFrom,
  rangeTo,
  selectedDay,
  onSelectDay,
  onPreviousMonth,
  onNextMonth,
  onToday,
  appointments,
  loadingAppointments,
  page,
  pageSize,
  onChangePage,
  onChangePageSize,
  statusLabels,
  renderActions,
}) => {
  const classes = useStyles();
  const today = new Date();
  const totalsByDay = useMemo(
    () => new Map((calendarDays || []).map((item) => [item.day, item])),
    [calendarDays]
  );
  const weeks = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);
    const days = eachDayOfInterval({
      start: startOfWeek(monthStart),
      end: endOfWeek(monthEnd),
    });
    const result = [];
    for (let index = 0; index < days.length; index += 7) {
      result.push(days.slice(index, index + 7));
    }
    return result;
  }, [visibleMonth]);

  const selectedDate = selectedDay ? parseISO(selectedDay) : null;
  const selectedDayLabel = selectedDate
    ? format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })
    : "";

  return (
    <div className={classes.calendar}>
      <div className={classes.toolbar}>
        <div className={classes.monthControls}>
          <Tooltip title="Mês anterior">
            <IconButton size="small" onClick={onPreviousMonth}>
              <ChevronLeftIcon />
            </IconButton>
          </Tooltip>
          <Typography variant="subtitle1" className={classes.monthTitle}>
            {format(visibleMonth, "MMMM 'de' yyyy", { locale: ptBR })}
          </Typography>
          <Tooltip title="Próximo mês">
            <IconButton size="small" onClick={onNextMonth}>
              <ChevronRightIcon />
            </IconButton>
          </Tooltip>
        </div>
        <Button size="small" startIcon={<TodayIcon />} onClick={onToday}>
          Hoje
        </Button>
      </div>

      <div className={classes.legend}>
        <span className={classes.legendItem}>
          <i className={`${classes.dot} ${classes.scheduled}`} /> Agendadas
        </span>
        <span className={classes.legendItem}>
          <i className={`${classes.dot} ${classes.waiting}`} /> Aguardando resposta
        </span>
        <span className={classes.legendItem}>
          <i className={`${classes.dot} ${classes.confirmed}`} /> Confirmadas
        </span>
        <span className={classes.legendItem}>
          <i className={`${classes.dot} ${classes.cancelled}`} /> Canceladas
        </span>
      </div>

      <div className={classes.weekdays}>
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
          <Typography key={day} variant="caption" className={classes.weekday}>
            {day}
          </Typography>
        ))}
      </div>

      {weeks.map((week) => {
        const weekHasSelection =
          selectedDate && week.some((day) => isSameDay(day, selectedDate));

        return (
          <div className={classes.week} key={dayKey(week[0])}>
            {week.map((day) => {
              const key = dayKey(day);
              const totals = totalsByDay.get(key);
              const inVisibleMonth = isSameMonth(day, visibleMonth);
              const inFilteredRange =
                inVisibleMonth && key >= rangeFrom && key <= rangeTo;
              const selected = selectedDate && isSameDay(day, selectedDate);
              const currentDay = isSameDay(day, today);

              return (
                <ButtonBase
                  key={key}
                  className={`${classes.day} ${
                    selected ? classes.selectedDay : ""
                  }`}
                  disabled={!inFilteredRange}
                  onClick={() => onSelectDay(key)}
                  aria-label={`${format(day, "dd/MM/yyyy")}${
                    totals ? `, ${totals.total} consultas` : ""
                  }`}
                  aria-pressed={Boolean(selected)}
                >
                  <Typography
                    variant="body2"
                    className={currentDay ? classes.todayNumber : classes.dayNumber}
                  >
                    {format(day, "d")}
                  </Typography>
                  {totals && Number(totals.total) > 0 && (
                    <>
                      <Typography variant="caption" className={classes.dayTotal}>
                        {totals.total} {Number(totals.total) === 1 ? "consulta" : "consultas"}
                      </Typography>
                      <div className={classes.bars} aria-hidden="true">
                        {Number(totals.scheduled) > 0 && (
                          <i className={`${classes.bar} ${classes.scheduled}`} />
                        )}
                        {Number(totals.awaitingResponse) > 0 && (
                          <i className={`${classes.bar} ${classes.waiting}`} />
                        )}
                        {Number(totals.confirmed) > 0 && (
                          <i className={`${classes.bar} ${classes.confirmed}`} />
                        )}
                        {Number(totals.cancelled) > 0 && (
                          <i className={`${classes.bar} ${classes.cancelled}`} />
                        )}
                      </div>
                    </>
                  )}
                </ButtonBase>
              );
            })}

            {weekHasSelection && (
              <div className={classes.expansion}>
                <div className={classes.expansionHeader}>
                  <div>
                    <Typography variant="subtitle1" style={{ textTransform: "capitalize" }}>
                      {selectedDayLabel}
                    </Typography>
                    <Typography variant="caption" className={classes.secondary}>
                      {appointments.total || 0} consulta(s) encontrada(s)
                    </Typography>
                  </div>
                </div>

                {loadingAppointments ? (
                  <div className={classes.loading}>
                    <CircularProgress size={28} />
                  </div>
                ) : appointments.rows.length ? (
                  <>
                    <div className={classes.appointmentList}>
                      {appointments.rows.map((row) => (
                        <div className={classes.appointment} key={row.id}>
                          <Typography className={classes.appointmentTime}>
                            {format(new Date(row.scheduledAt), "HH:mm")}
                          </Typography>
                          <div>
                            <Typography variant="body2">{row.patient}</Typography>
                            <Typography variant="caption" className={classes.secondary}>
                              {row.phone ? `+${String(row.phone).replace(/^\+/, "")}` : "Sem telefone"}
                            </Typography>
                          </div>
                          <Typography variant="body2">{row.professional}</Typography>
                          <Chip
                            size="small"
                            label={
                              row.awaitingConfirmation
                                ? "Aguardando resposta"
                                : statusLabels[row.status] || row.status
                            }
                            color={row.status === "CONFIRMADO" ? "primary" : "default"}
                          />
                          {renderActions(row)}
                        </div>
                      ))}
                    </div>
                    <TablePagination
                      className={classes.pagination}
                      component="div"
                      count={appointments.total || 0}
                      page={page}
                      onChangePage={(_, nextPage) => onChangePage(nextPage)}
                      rowsPerPage={pageSize}
                      onChangeRowsPerPage={(event) =>
                        onChangePageSize(Number(event.target.value))
                      }
                      rowsPerPageOptions={[10, 25, 50, 100]}
                      labelRowsPerPage="Consultas por página"
                    />
                  </>
                ) : (
                  <Typography className={classes.empty}>
                    Nenhuma consulta encontrada neste dia com os filtros atuais.
                  </Typography>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default QuarkAppointmentsCalendar;
