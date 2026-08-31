import React, { useCallback, useEffect, useState } from "react";
import {
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  makeStyles
} from "@material-ui/core";
import RefreshIcon from "@material-ui/icons/Refresh";
import LinkIcon from "@material-ui/icons/Link";
import api from "../../services/api";
import openSocket from "../../services/socket-io";
import toastError from "../../errors/toastError";
import ResponsiveTable from "../ResponsiveTable";
import TableEmptyState from "../TableEmptyState";
import ContactAvatar from "../ContactAvatar";
import { contactDisplayName, contactPhoneLabel } from "../../services/contactIdentity";

const labels = {
  UNRESOLVED_LID: "Telefone não identificado",
  TECHNICAL_NAME: "Nome técnico",
  AMBIGUOUS_QUARK_PATIENT: "Mais de um paciente possível",
  CPF_CONFLICT: "CPF divergente",
  MISSING_CPF: "CPF ausente"
};

const useStyles = makeStyles(theme => ({
  root: { display: "flex", flexDirection: "column", gap: theme.spacing(2), minHeight: 0 },
  toolbar: { display: "flex", gap: theme.spacing(1), alignItems: "center", flexWrap: "wrap" },
  summary: { display: "flex", gap: theme.spacing(1), flexWrap: "wrap" },
  table: { ...theme.panelStyles, minHeight: 280 },
  candidate: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 10,
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2)
  }
}));

const IdentityIssuesPanel = () => {
  const classes = useStyles();
  const [data, setData] = useState({ issues: [], summary: { total: 0, byType: {} } });
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/contacts/identity/issues", { params: { type, search } });
      setData(response.data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [type, search]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const socket = openSocket();
    socket.on("identityHealth", load);
    return () => socket.disconnect();
  }, [load]);

  const reconcile = async contactId => {
    setRunning(true);
    try {
      await api.post("/contacts/identity/reconcile", contactId ? { contactId } : {});
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setRunning(false);
    }
  };

  const resolve = async (issue, action, patientId) => {
    setRunning(true);
    try {
      await api.post(`/contacts/identity/issues/${issue.id}/resolve`, { action, patientId });
      setSelected(null);
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setRunning(false);
    }
  };

  const candidates = selected?.evidence?.candidates || [];
  return (
    <div className={classes.root}>
      <div className={classes.summary} aria-label="Resumo de pendências de identidade">
        <Chip color={data.summary.total ? "secondary" : "default"} label={`${data.summary.total} pendência(s)`} />
        {Object.entries(data.summary.byType || {}).map(([key, count]) => (
          <Chip key={key} variant="outlined" label={`${labels[key] || key}: ${count}`} />
        ))}
      </div>
      <div className={classes.toolbar}>
        <TextField
          size="small"
          variant="outlined"
          label="Buscar contato"
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
        <TextField
          select
          size="small"
          variant="outlined"
          label="Tipo de problema"
          value={type}
          onChange={event => setType(event.target.value)}
          style={{ minWidth: 220 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {Object.entries(labels).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}
        </TextField>
        <Button startIcon={running ? <CircularProgress size={16} /> : <RefreshIcon />} variant="outlined" color="primary" disabled={running} onClick={() => reconcile()}>
          Reconciliar agora
        </Button>
      </div>
      <Paper className={classes.table} variant="outlined">
        <ResponsiveTable size="medium" aria-label="Pendências de identidade">
          <TableHead><TableRow>
            <TableCell padding="checkbox" />
            <TableCell>Contato</TableCell>
            <TableCell>Telefone</TableCell>
            <TableCell>Problema</TableCell>
            <TableCell>Origem / vínculo</TableCell>
            <TableCell align="right">Ações</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {!loading && !data.issues.length && <TableEmptyState columns={6} title="Identidades conciliadas" description="Nenhuma pendência encontrada nos filtros atuais." />}
            {data.issues.map(issue => (
              <TableRow key={issue.id}>
                <TableCell padding="checkbox"><ContactAvatar contact={issue.contact} /></TableCell>
                <TableCell data-mobile-primary>{contactDisplayName(issue.contact)}</TableCell>
                <TableCell data-label="Telefone">{contactPhoneLabel(issue.contact)}</TableCell>
                <TableCell data-label="Problema"><Chip size="small" color={issue.severity === "CRITICAL" ? "secondary" : "default"} label={labels[issue.type] || issue.type} /></TableCell>
                <TableCell data-label="Vínculo">{issue.quarkLink?.status === "CONFIRMED" ? "Quark confirmado" : issue.quarkLink?.status === "AMBIGUOUS" ? "Quark ambíguo" : "WhatsApp"}</TableCell>
                <TableCell data-mobile-actions align="right">
                  <Button size="small" color="primary" onClick={() => setSelected(issue)}>Revisar</Button>
                </TableCell>
              </TableRow>
            ))}
            {loading && <TableRow><TableCell colSpan={6} align="center"><CircularProgress size={24} /></TableCell></TableRow>}
          </TableBody>
        </ResponsiveTable>
      </Paper>
      <Dialog open={Boolean(selected)} onClose={() => !running && setSelected(null)} fullWidth maxWidth="sm">
        <DialogTitle>Revisar identidade do paciente</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1">{selected ? contactDisplayName(selected.contact) : ""}</Typography>
          <Typography color="textSecondary" paragraph>{selected ? contactPhoneLabel(selected.contact) : ""}</Typography>
          <Typography variant="subtitle2" gutterBottom>{selected ? labels[selected.type] || selected.type : ""}</Typography>
          {candidates.length > 0 ? candidates.map(candidate => (
            <div className={classes.candidate} key={candidate.patientId}>
              <div>
                <Typography>{candidate.patientName}</Typography>
                <Typography variant="body2" color="textSecondary">CPF {candidate.cpf || "não informado"} · cadastro {candidate.patientId}</Typography>
              </div>
              <Button startIcon={<LinkIcon />} color="primary" variant="contained" disabled={running} onClick={() => resolve(selected, "CONFIRM_PATIENT", candidate.patientId)}>
                Vincular
              </Button>
            </div>
          )) : (
            <Typography color="textSecondary" paragraph>Nenhum paciente único foi localizado no Quark. Você pode manter os registros separados ou tentar novamente após corrigir o telefone.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={running} onClick={() => reconcile(selected?.contactId)}>Tentar novamente</Button>
          <Button disabled={running} onClick={() => resolve(selected, "IGNORE")}>Ignorar pendência</Button>
          <Button disabled={running} color="secondary" onClick={() => resolve(selected, "KEEP_SEPARATE")}>Manter separados</Button>
          <Button disabled={running} onClick={() => setSelected(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default IdentityIssuesPanel;
