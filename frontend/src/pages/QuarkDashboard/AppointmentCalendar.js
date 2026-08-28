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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 4,
    padding: theme.spacing(1)
  },
  day: {
    minWidth: 0,
    minHeight: 76,
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    flexDirection: "column",
    gap: 4,
    color: theme.palette.text.primary,
    "&:hover": { backgroundColor: theme.palette.action.hover },
    [theme.breakpoints.down("sm")]: { minHeight: 56 }
  },
  selected: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    "&:hover": { backgroundColor: theme.palette.primary.dark }
  },
  count: { fontSize: 11, lineHeight: 1.2, opacity: 0.85 },
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
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        px={1}
        pt={1}
      >
        <IconButton aria-label="Mês anterior" onClick={() => onMonth(-1)}>
          <ChevronLeft />
        </IconButton>
        <Typography
          component="h3"
          variant="subtitle1"
          style={{ textTransform: "capitalize", fontWeight: 600 }}
        >
          {month.toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric"
          })}
        </Typography>
        <Button size="small" onClick={onToday}>
          Hoje
        </Button>
        <IconButton aria-label="Próximo mês" onClick={() => onMonth(1)}>
          <ChevronRight />
        </IconButton>
      </Box>
      <div className={classes.grid}>
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(day => (
          <Typography
            key={day}
            align="center"
            variant="caption"
            color="textSecondary"
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
          const label = `${i + 1} de ${month.toLocaleDateString("pt-BR", {
            month: "long"
          })}: ${count} consultas`;
          return (
            <ButtonBase
              key={key}
              disabled={key < from || key > to}
              focusVisibleClassName={classes.focus}
              className={`${classes.day} ${
                selected === key ? classes.selected : ""
              }`}
              aria-label={label}
              aria-pressed={selected === key}
              onClick={() => onSelect(key)}
            >
              <Typography
                component="span"
                style={{ fontWeight: selected === key || count ? 700 : 400 }}
              >
                {i + 1}
              </Typography>
              <span className={classes.count}>
                {count ? `${count} consultas` : "—"}
              </span>
            </ButtonBase>
          );
        })}
      </div>
      <Box px={2} pb={1}>
        <Typography variant="caption" color="textSecondary">
          Selecione um dia para ver os pacientes e as pendências abaixo.
        </Typography>
      </Box>
    </Box>
  );
}
