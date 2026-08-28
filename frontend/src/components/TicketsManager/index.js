import React, { useContext, useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Collapse,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  makeStyles
} from "@material-ui/core";
import AddIcon from "@material-ui/icons/Add";
import SearchIcon from "@material-ui/icons/Search";
import TuneIcon from "@material-ui/icons/Tune";
import ClearIcon from "@material-ui/icons/Clear";
import NewTicketModal from "../NewTicketModal";
import TicketsList from "../TicketsList";
import TicketsAssigneeSelect from "../TicketsAssigneeSelect";
import TicketsQueueSelect from "../TicketsQueueSelect";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    borderRadius: 0
  },
  header: {
    padding: theme.spacing(2),
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  title: { fontWeight: 800, letterSpacing: "-.025em" },
  searchRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: theme.spacing(0, 1.5, 1.5)
  },
  search: {
    flex: 1,
    minWidth: 0,
    "& .MuiOutlinedInput-root": { background: theme.modeTokens.surfaceMuted },
    "& .MuiInputBase-input": { fontSize: ".8125rem" }
  },
  filters: {
    display: "grid",
    gap: 14,
    padding: theme.spacing(0.5, 1.5, 1.5),
    "& .MuiFormControlLabel-label": { fontSize: ".75rem" }
  },
  filterRow: { display: "flex", alignItems: "center", gap: 8 },
  tabs: {
    borderTop: `1px solid ${theme.palette.divider}`,
    borderBottom: `1px solid ${theme.palette.divider}`,
    minHeight: 46
  },
  tab: {
    minWidth: 0,
    padding: "6px 8px",
    minHeight: 46,
    fontSize: ".75rem",
    flex: 1
  },
  tabLabel: { display: "flex", alignItems: "center", gap: 5 },
  count: {
    fontSize: ".65rem",
    fontWeight: 750,
    borderRadius: 6,
    padding: "1px 5px",
    background: theme.modeTokens.surfaceMuted,
    color: theme.palette.text.secondary
  },
  list: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" },
  scope: {
    padding: theme.spacing(0, 1.5, 1),
    margin: 0,
    "& .MuiFormControlLabel-label": { fontSize: ".75rem" }
  }
}));

export default function TicketsManager({
  status = "open",
  onStatusChange,
  onCountsChange
}) {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [query, setQuery] = useState("");
  const [searchParam, setSearchParam] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [allStatuses, setAllStatuses] = useState(true);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [date, setDate] = useState("");
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [assignee, setAssignee] = useState(
    user.profile === "admin" ? "all" : "default"
  );
  const [queueIds, setQueueIds] = useState(
    (user.queues || []).map(queue => queue.id)
  );
  const [counts, setCounts] = useState({
    open: null,
    pending: null,
    closed: null
  });
  const showAll = assignee === "all" || assignee.startsWith("user:");
  const searchAcrossStatuses = Boolean(searchParam && allStatuses);

  useEffect(() => {
    const timer = setTimeout(() => setSearchParam(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (onCountsChange) onCountsChange(counts);
  }, [counts, onCountsChange]);
  useEffect(
    () => setCounts({ open: null, pending: null, closed: null }),
    [assignee, date, onlyUnread, searchParam, queueIds]
  );

  const common = {
    assignee: assignee === "default" ? undefined : assignee,
    selectedQueueIds: queueIds,
    searchParam,
    date: date || undefined,
    withUnreadMessages: onlyUnread ? "true" : "false",
    showAll
  };

  return (
    <Paper className={classes.root}>
      <NewTicketModal
        modalOpen={newTicketOpen}
        onClose={() => setNewTicketOpen(false)}
      />
      <div className={classes.header}>
        <div>
          <Typography variant="h6" className={classes.title}>
            Atendimentos
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {counts.open == null || counts.pending == null
              ? "Atualizando sua fila…"
              : `${counts.open + counts.pending} ${
                  counts.open + counts.pending === 1
                    ? "conversa ativa"
                    : "conversas ativas"
                } nos filtros`}
          </Typography>
        </div>
        <Tooltip title="Novo atendimento">
          <Button
            size="small"
            color="primary"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setNewTicketOpen(true)}
          >
            Novo
          </Button>
        </Tooltip>
      </div>
      <div className={classes.searchRow}>
        <TextField
          className={classes.search}
          size="small"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Nome, telefone ou mensagem"
          inputProps={{ "aria-label": "Buscar atendimentos" }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
            endAdornment: query ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label="Limpar busca"
                  onClick={() => setQuery("")}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null
          }}
        />
        <Tooltip title="Filtros de atendimento">
          <IconButton
            aria-label="Filtros de atendimento"
            aria-expanded={filtersOpen}
            aria-controls="ticket-filters"
            color={filtersOpen || onlyUnread || date ? "primary" : "default"}
            onClick={() => setFiltersOpen(value => !value)}
          >
            <TuneIcon />
          </IconButton>
        </Tooltip>
      </div>
      {query && (
        <FormControlLabel
          className={classes.scope}
          control={
            <Checkbox
              size="small"
              color="primary"
              checked={allStatuses}
              onChange={event => setAllStatuses(event.target.checked)}
            />
          }
          label="Buscar em todos os status"
        />
      )}
      <Collapse in={filtersOpen}>
        <div className={classes.filters} id="ticket-filters">
          <div className={classes.filterRow}>
            <TicketsAssigneeSelect
              value={assignee}
              onChange={setAssignee}
              canViewOthers={
                user.profile === "admin" ||
                user.canViewOtherAgentsTickets === true
              }
            />
            <TicketsQueueSelect
              selectedQueueIds={queueIds}
              userQueues={user.queues}
              onChange={setQueueIds}
            />
          </div>
          <TextField
            id="ticket-created-date"
            size="small"
            type="date"
            label="Criado em"
            InputLabelProps={{ shrink: true }}
            value={date}
            onChange={event => setDate(event.target.value)}
            helperText="Filtro pela data de criação do atendimento."
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                color="primary"
                checked={onlyUnread}
                onChange={event => setOnlyUnread(event.target.checked)}
              />
            }
            label="Somente não lidas"
          />
        </div>
      </Collapse>
      <Tabs
        className={classes.tabs}
        value={status}
        variant="fullWidth"
        indicatorColor="primary"
        textColor="primary"
        aria-label="Status dos atendimentos"
        onChange={(_, value) => {
          onStatusChange(value);
          setAllStatuses(false);
        }}
      >
        {[
          ["open", "Atendendo"],
          ["pending", "Aguardando"],
          ["closed", "Resolvidos"]
        ].map(([value, label]) => (
          <Tab
            key={value}
            value={value}
            className={classes.tab}
            label={
              <span className={classes.tabLabel}>
                {label}
                <span className={classes.count}>
                  {counts[value] == null ? "—" : counts[value]}
                </span>
              </span>
            }
          />
        ))}
      </Tabs>
      <div className={classes.list}>
        {["open", "pending", "closed"].map(value => (
          <TicketsList
            {...common}
            key={`${value}:${JSON.stringify(common)}`}
            status={value}
            showAll={value === "closed" ? true : showAll}
            style={
              status !== value || searchAcrossStatuses
                ? { display: "none" }
                : undefined
            }
            updateCount={count =>
              setCounts(previous =>
                previous[value] === count
                  ? previous
                  : { ...previous, [value]: count }
              )
            }
          />
        ))}
        {searchAcrossStatuses && (
          <TicketsList
            {...common}
            key={`search:${JSON.stringify(common)}`}
            showAll={true}
          />
        )}
      </div>
    </Paper>
  );
}
