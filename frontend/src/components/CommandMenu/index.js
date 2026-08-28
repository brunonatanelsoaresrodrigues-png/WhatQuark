import React, { useContext, useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  InputAdornment,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
  makeStyles
} from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import ArrowForwardIcon from "@material-ui/icons/ArrowForward";
import { useHistory } from "react-router-dom";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useThemeContext } from "../../context/DarkMode";
import NewTicketModal from "../NewTicketModal";

const useStyles = makeStyles(theme => ({
  trigger: {
    minWidth: 40,
    color: theme.palette.text.secondary,
    borderColor: theme.palette.divider,
    padding: "6px 10px",
    [theme.breakpoints.down("sm")]: { display: "none" }
  },
  shortcut: {
    fontSize: 11,
    marginLeft: 8,
    whiteSpace: "nowrap",
    color: theme.palette.text.secondary
  },
  content: { padding: 16 },
  row: { borderRadius: 10, marginTop: 4 },
  footer: { padding: "0 24px 16px", color: theme.palette.text.secondary }
}));

export default function CommandMenu() {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const { toggleTheme } = useThemeContext();
  const history = useHistory();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  useEffect(() => {
    const shortcut = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuery("");
        setOpen(value => !value);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const actions = [
    { title: "Novo atendimento", run: () => setNewTicketOpen(true) },
    { title: "Ir para atendimentos", run: () => history.push("/tickets") },
    { title: "Ir para visão geral", run: () => history.push("/") },
    { title: "Buscar contato", run: () => history.push("/contacts") },
    { title: "Trocar tema", run: toggleTheme },
    ...(user.profile === "admin"
      ? [
          { title: "Ir para filas", run: () => history.push("/queues") },
          { title: "Configurações", run: () => history.push("/settings") }
        ]
      : [])
  ].filter(action =>
    action.title
      .toLocaleLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .includes(
        query
          .toLocaleLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
      )
  );
  const run = action => {
    setOpen(false);
    action.run();
  };
  return (
    <>
      <Button
        className={classes.trigger}
        variant="outlined"
        aria-label="Abrir atalhos de navegação"
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
      >
        <SearchIcon fontSize="small" />
        <span className={classes.shortcut}>Ctrl / ⌘ K</span>
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="command-menu-title"
      >
        <DialogContent className={classes.content}>
          <Typography
            id="command-menu-title"
            component="h2"
            variant="subtitle2"
            gutterBottom
          >
            Atalhos de navegação
          </Typography>
          <TextField
            fullWidth
            autoFocus
            value={query}
            placeholder="O que você quer fazer?"
            inputProps={{ "aria-label": "Buscar ação" }}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && actions[0]) run(actions[0]);
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              )
            }}
          />
          <List aria-label="Ações disponíveis">
            {actions.map(action => (
              <ListItem
                button
                component="button"
                className={classes.row}
                key={action.title}
                onClick={() => run(action)}
              >
                <ListItemIcon>
                  <ArrowForwardIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={action.title} />
              </ListItem>
            ))}
            {!actions.length && (
              <Typography color="textSecondary" style={{ padding: 16 }}>
                Nenhuma ação encontrada.
              </Typography>
            )}
          </List>
        </DialogContent>
        <Typography variant="caption" className={classes.footer}>
          Tab para navegar · Enter para abrir · Esc para fechar
        </Typography>
      </Dialog>
      <NewTicketModal
        modalOpen={newTicketOpen}
        onClose={() => setNewTicketOpen(false)}
      />
    </>
  );
}
