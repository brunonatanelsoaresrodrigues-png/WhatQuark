import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
  makeStyles
} from "@material-ui/core";
import { Close, Search } from "@material-ui/icons";
import { format, parseISO } from "date-fns";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
  root: {
    flex: "0 0 auto",
    zIndex: 4,
    padding: theme.spacing(1.25, 1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
    boxShadow: theme.productTokens.shadows.rest
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1)
  },
  field: { flex: 1 },
  summary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 26,
    padding: theme.spacing(0.5, 0.5, 0)
  },
  results: {
    maxHeight: 220,
    overflowY: "auto",
    padding: 0,
    ...theme.scrollbarStyles
  },
  result: {
    borderRadius: 8,
    alignItems: "flex-start",
    "&:hover": { background: theme.palette.action.hover }
  },
  excerpt: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical"
  },
  meta: { color: theme.palette.text.secondary, fontSize: ".72rem" },
  loadMore: { display: "flex", justifyContent: "center", paddingTop: 6 }
}));

const ConversationSearchPanel = ({
  open,
  ticketId,
  onClose,
  onSelect
}) => {
  const classes = useStyles();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [results, setResults] = useState([]);
  const [count, setCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    setPageNumber(1);
    setResults([]);
    setCount(0);
    setHasMore(false);
  }, [query, ticketId]);

  useEffect(() => {
    const normalized = query.trim();
    if (!open || normalized.length < 2) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/messages/${ticketId}/search`, {
          params: { q: normalized, pageNumber }
        });
        if (!active) return;
        setResults(previous =>
          pageNumber === 1 ? data.results : [...previous, ...data.results]
        );
        setCount(data.count);
        setHasMore(data.hasMore);
      } catch (error) {
        if (active) toastError(error);
      } finally {
        if (active) setLoading(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, pageNumber, query, ticketId]);

  if (!open) return null;
  const normalized = query.trim();

  return (
    <section className={classes.root} aria-label="Pesquisar na conversa">
      <div className={classes.header}>
        <TextField
          inputRef={inputRef}
          className={classes.field}
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter" && results[0]) onSelect(results[0]);
            if (event.key === "Escape") onClose();
          }}
          placeholder="Pesquisar mensagens desta conversa"
          variant="outlined"
          size="small"
          inputProps={{ maxLength: 100, "aria-label": "Texto da pesquisa" }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: loading ? (
              <InputAdornment position="end">
                <CircularProgress size={18} />
              </InputAdornment>
            ) : null
          }}
        />
        <IconButton aria-label="Fechar pesquisa" onClick={onClose} size="small">
          <Close />
        </IconButton>
      </div>
      <div className={classes.summary}>
        <Typography variant="caption" color="textSecondary">
          {normalized.length < 2
            ? "Digite pelo menos 2 caracteres."
            : loading && !results.length
            ? "Pesquisando em todo o histórico…"
            : `${count} resultado(s)`}
        </Typography>
      </div>
      {results.length > 0 && (
        <List className={classes.results} dense>
          {results.map(result => (
            <ListItem
              key={result.id}
              button
              className={classes.result}
              onClick={() => onSelect(result)}
            >
              <ListItemText
                primary={
                  <span className={classes.excerpt}>
                    {result.excerpt || "Mensagem sem texto"}
                  </span>
                }
                secondary={
                  <span className={classes.meta}>
                    {result.fromMe
                      ? "Equipe"
                      : result.contact?.name || "Paciente"}
                    {" · "}
                    {format(parseISO(result.createdAt), "dd/MM/yyyy HH:mm")}
                  </span>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
      {hasMore && (
        <div className={classes.loadMore}>
          <Button
            size="small"
            disabled={loading}
            onClick={() => setPageNumber(value => value + 1)}
          >
            Carregar mais resultados
          </Button>
        </div>
      )}
    </section>
  );
};

export default ConversationSearchPanel;
