import React from "react";
import {
  Box,
  Button,
  ButtonBase,
  IconButton,
  Typography,
  makeStyles
} from "@material-ui/core";
import ChevronLeft from "@material-ui/icons/ChevronLeft";
import ChevronRight from "@material-ui/icons/ChevronRight";

const useStyles = makeStyles(theme => ({
  header: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 1.5, 1),
    borderBottom: `1px solid ${theme.palette.divider}`
  },
  monthControls: {
    display: "flex",
    alignItems: "center"
  },
  monthTitle: {
    textAlign: "center",
    textTransform: "capitalize",
    fontWeight: 700,
    letterSpacing: "-.015em"
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 6,
    padding: theme.spacing(1.5)
  },
  weekday: {
    paddingBottom: theme.spacing(0.5),
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: ".07em",
    textTransform: "uppercase"
  },
  day: {
    position: "relative",
    minWidth: 0,
    minHeight: 72,
    padding: theme.spacing(1),
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 8,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.paper,
    transition: "border-color 140ms ease, background-color 140ms ease",
    "&:hover": {
      borderColor: theme.palette.primary.main,
      backgroundColor: theme.palette.action.hover
    },
    "&.Mui-disabled": {
      opacity: 0.36,
      color: theme.palette.text.disabled
    },
    [theme.breakpoints.down("sm")]: {
      minHeight: 56,
      padding: theme.spacing(0.65)
    }
  },
  selected: {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.modeTokens.selected,
    boxShadow: `inset 0 0 0 1px ${theme.palette.primary.main}`,
    "&:hover": {
      backgroundColor: theme.modeTokens.surfaceTint
    }
  },
  today: {
    "&:before": {
      content: '""',
      position: "absolute",
      width: 5,
      height: 5,
      top: 7,
      right: 7,
      borderRadius: "50%",
      backgroundColor: theme.palette.primary.main
    }
  },
  dayTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: 600
  },
  count: {
    fontSize: 12,
    lineHeight: 1.2,
    color: theme.palette.text.secondary,
    whiteSpace: "nowrap"
  },
  daySummary: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2
  },
  confirmedCount: {
    fontSize: 11,
    lineHeight: 1.2,
    color: theme.statusTokens.success.fg,
    whiteSpace: "nowrap"
  },
  statusBar: {
    display: "flex",
    height: 4,
    width: "100%",
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: theme.palette.action.hover
  },
  confirmed: { backgroundColor: theme.statusTokens.success.fg },
  awaiting: { backgroundColor: theme.statusTokens.warning.fg },
  scheduled: { backgroundColor: theme.statusTokens.info.fg },
  cancelled: { backgroundColor: theme.statusTokens.danger.fg },
  legend: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
    padding: theme.spacing(1, 2, 1.5),
    borderTop: `1px solid ${theme.palette.divider}`
  },
  legendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    color: theme.palette.text.secondary,
    fontSize: 12
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: "50%"
  },
  focus: {
    outline: `3px solid ${theme.palette.secondary.main}`,
    outlineOffset: 1
  }
}));
const dateKey = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;

export default function AppointmentCalendar({
  days,
  from,
  to,
  selected,
  onSelect,
  onMonth,
  onToday,
  loading
}) {
  const classes = useStyles();
  const month = new Date(`${from}T12:00:00`);
  const today = dateKey(new Date());
  month.setDate(1);
  const offset = (month.getDay() + 6) % 7;
  const total = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate();
  const byDay = new Map(
    (Array.isArray(days) ? days : []).map(item => [item.day, item])
  );
  return (
    <Box aria-label="Calendário de consultas" aria-busy={loading}>
      <div className={classes.header}>
        <div className={classes.monthControls}>
          <IconButton
            size="small"
            aria-label="Mês anterior"
            onClick={() => onMonth(-1)}
          >
            <ChevronLeft />
          </IconButton>
          <IconButton
            size="small"
            aria-label="Próximo mês"
            onClick={() => onMonth(1)}
          >
            <ChevronRight />
          </IconButton>
        </div>
        <Typography
          component="h3"
          variant="subtitle1"
          className={classes.monthTitle}
        >
          {month.toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric"
          })}
        </Typography>
        <Button size="small" variant="outlined" onClick={onToday}>
          Hoje
        </Button>
      </div>
      <div className={classes.grid}>
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(day => (
          <Typography
            key={day}
            align="center"
            variant="caption"
            color="textSecondary"
            className={classes.weekday}
          >
            {day}
          </Typography>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: total }, (_, i) => {
          const key = dateKey(
            new Date(month.getFullYear(), month.getMonth(), i + 1)
          );
          const count = byDay.get(key)?.total || 0;
          const stats = byDay.get(key) || {};
          const confirmed = Number(stats.confirmed || 0);
          const label = `${i + 1} de ${month.toLocaleDateString("pt-BR", {
            month: "long"
          })}: ${count} consulta${count === 1 ? "" : "s"}, ${confirmed} confirmada${
            confirmed === 1 ? "" : "s"
          }`;
          return (
            <ButtonBase
              key={key}
              disabled={key < from || key > to}
              focusVisibleClassName={classes.focus}
              className={`${classes.day} ${
                selected === key ? classes.selected : ""
              } ${today === key ? classes.today : ""}`}
              aria-label={label}
              aria-pressed={selected === key}
              onClick={() => onSelect(key)}
            >
              <span className={classes.dayTop}>
                <span className={classes.dayNumber}>{i + 1}</span>
                <span className={classes.daySummary}>
                  <span className={classes.count}>
                    {count
                      ? `${count} consulta${count === 1 ? "" : "s"}`
                      : "—"}
                  </span>
                  {count > 0 && (
                    <span className={classes.confirmedCount}>
                      {confirmed} confirmada{confirmed === 1 ? "" : "s"}
                    </span>
                  )}
                </span>
              </span>
              <span className={classes.statusBar} aria-hidden="true">
                {count > 0 && (
                  <>
                    <span
                      className={classes.confirmed}
                      style={{ flex: Number(stats.confirmed || 0) }}
                    />
                    <span
                      className={classes.awaiting}
                      style={{ flex: Number(stats.awaitingResponse || 0) }}
                    />
                    <span
                      className={classes.scheduled}
                      style={{ flex: Number(stats.scheduled || 0) }}
                    />
                    <span
                      className={classes.cancelled}
                      style={{ flex: Number(stats.cancelled || 0) }}
                    />
                  </>
                )}
              </span>
            </ButtonBase>
          );
        })}
      </div>
      <div className={classes.legend}>
        {[
          ["Confirmadas", classes.confirmed],
          ["Aguardando resposta", classes.awaiting],
          ["Agendadas", classes.scheduled],
          ["Canceladas", classes.cancelled]
        ].map(([label, colorClass]) => (
          <span key={label} className={classes.legendItem}>
            <span className={`${classes.legendDot} ${colorClass}`} />
            {label}
          </span>
        ))}
      </div>
    </Box>
  );
}
