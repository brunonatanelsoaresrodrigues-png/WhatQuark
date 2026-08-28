import React, { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  makeStyles
} from "@material-ui/core";
import AddIcon from "@material-ui/icons/Add";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import RefreshIcon from "@material-ui/icons/Refresh";
import SendIcon from "@material-ui/icons/Send";
import VisibilityIcon from "@material-ui/icons/Visibility";
import ReplayIcon from "@material-ui/icons/Replay";
import GetAppIcon from "@material-ui/icons/GetApp";
import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import PageHeading from "../../components/PageHeading";
import PageSkeleton from "../../components/PageSkeleton";

const useStyles = makeStyles(theme => ({
  container: {
    padding: theme.spacing(3.5, 4, 4),
    [theme.breakpoints.down("sm")]: { padding: theme.spacing(2) }
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing(2)
  },
  card: { height: "100%" },
  section: { padding: theme.spacing(2), marginTop: theme.spacing(3) },
  form: { display: "flex", gap: theme.spacing(2), flexWrap: "wrap" },
  grow: { flex: "1 1 240px" },
  statusRow: { display: "flex", gap: theme.spacing(1), flexWrap: "wrap" },
  preview: {
    whiteSpace: "pre-wrap",
    background: theme.modeTokens.surfaceMuted,
    padding: theme.spacing(2),
    borderRadius: 12,
    maxHeight: 520,
    overflow: "auto"
  },
  actions: { display: "flex", gap: theme.spacing(1), flexWrap: "wrap" }
}));

const dateTime = value =>
  value ? new Date(value).toLocaleString("pt-BR") : "—";

const deliveryColor = status => {
  if (["READ", "DELIVERED", "SENT", "COMPLETED"].includes(status))
    return "primary";
  if (["DEAD_LETTER", "FAILED_RETRY", "FAILED"].includes(status))
    return "secondary";
  return "default";
};

const DailyReports = () => {
  const classes = useStyles();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [preview, setPreview] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/daily-reports");
      setData(response.data);
    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (key, action, success) => {
    setBusy(key);
    try {
      await action();
      toast.success(success);
      await load();
    } catch (error) {
      toastError(error);
    } finally {
      setBusy("");
    }
  };

  const addRecipient = event => {
    event.preventDefault();
    runAction(
      "create",
      () => api.post("/daily-reports/recipients", { name, phone }),
      "Gestor cadastrado. Valide o WhatsApp antes de ativar."
    ).then(() => {
      setName("");
      setPhone("");
    });
  };

  const generatePreview = async () => {
    setBusy("preview");
    try {
      const response = await api.post("/daily-reports/preview");
      setPreview(response.data.body || "Prévia sem conteúdo.");
      toast.success("Prévia gerada sem envio.");
      await load();
    } catch (error) {
      toastError(error);
    } finally {
      setBusy("");
    }
  };

  const downloadCsv = async run => {
    setBusy(`csv-${run.id}`);
    try {
      const response = await api.get(`/daily-reports/runs/${run.id}/csv`, {
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `fechamento-${run.reportDate}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toastError(error);
    } finally {
      setBusy("");
    }
  };

  if (loading && !data) {
    return <PageSkeleton />;
  }

  const config = data?.config || {};
  const recipients = data?.recipients || [];
  const runs = data?.runs || [];

  return (
    <Container maxWidth="xl" className={classes.container}>
      <PageHeading
        title="Relatórios diários"
        eyebrow="Gestão da operação"
        description="Fechamento gerencial agregado, sem dados identificáveis de pacientes."
        actions={
          <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            Atualizar
          </Button>
        }
      />

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <Card className={classes.card}>
            <CardContent>
              <Typography color="textSecondary">Execução</Typography>
              <Typography variant="h6">
                Todos os dias às {config.reportTime || "17:00"}
              </Typography>
              <Typography variant="caption">{config.timezone}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className={classes.card}>
            <CardContent>
              <Typography color="textSecondary">Automação</Typography>
              <div className={classes.statusRow}>
                <Chip
                  label={config.enabled ? "Ativa" : "Desativada"}
                  color={config.enabled ? "primary" : "default"}
                />
                {config.testMode && <Chip label="Homologação" />}
              </div>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className={classes.card}>
            <CardContent>
              <Typography color="textSecondary">Canal de envio</Typography>
              <Typography variant="h6">
                {config.whatsapp?.name || "Não configurado"}
              </Typography>
              <Chip
                size="small"
                label={config.whatsapp?.status || "SEM CANAL"}
                color={
                  config.whatsapp?.status === "CONNECTED"
                    ? "primary"
                    : "secondary"
                }
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className={classes.card}>
            <CardContent>
              <Typography color="textSecondary">Destinatários</Typography>
              <Typography variant="h4">
                {recipients.filter(item => item.active).length}
              </Typography>
              <Typography variant="caption">
                ativos de {recipients.length} cadastrados
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper className={classes.section}>
        <Typography variant="h6" gutterBottom>
          Destinatários do fechamento
        </Typography>
        <form className={classes.form} onSubmit={addRecipient}>
          <TextField
            id="report-recipient-name"
            className={classes.grow}
            label="Nome do gestor"
            value={name}
            onChange={event => setName(event.target.value)}
            required
          />
          <TextField
            id="report-recipient-phone"
            type="tel"
            className={classes.grow}
            label="WhatsApp com DDI e DDD"
            value={phone}
            onChange={event => setPhone(event.target.value)}
            placeholder="+55..."
            required
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            startIcon={
              busy === "create" ? <CircularProgress size={16} /> : <AddIcon />
            }
            disabled={Boolean(busy)}
          >
            Cadastrar
          </Button>
        </form>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Gestor</TableCell>
                <TableCell>Telefone</TableCell>
                <TableCell>Validação</TableCell>
                <TableCell>Ativo</TableCell>
                <TableCell>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recipients.map(recipient => (
                <TableRow key={recipient.id}>
                  <TableCell>{recipient.name}</TableCell>
                  <TableCell>{recipient.phone}</TableCell>
                  <TableCell>
                    {recipient.verifiedAt
                      ? `Validado em ${dateTime(recipient.verifiedAt)}`
                      : "Pendente"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={recipient.active}
                      disabled={!recipient.verifiedAt || Boolean(busy)}
                      onChange={() =>
                        runAction(
                          `active-${recipient.id}`,
                          () =>
                            api.put(
                              `/daily-reports/recipients/${recipient.id}`,
                              { active: !recipient.active }
                            ),
                          recipient.active
                            ? "Destinatário pausado."
                            : "Destinatário ativado."
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className={classes.actions}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<CheckCircleOutlineIcon />}
                        disabled={Boolean(busy)}
                        onClick={() =>
                          runAction(
                            `verify-${recipient.id}`,
                            () =>
                              api.post(
                                `/daily-reports/recipients/${recipient.id}/verify`
                              ),
                            "Número validado no canal conectado."
                          )
                        }
                      >
                        Validar
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        startIcon={<SendIcon />}
                        disabled={!recipient.verifiedAt || Boolean(busy)}
                        onClick={() =>
                          window.confirm(
                            `Enviar agora uma cópia de teste para ${recipient.name}?`
                          ) &&
                          runAction(
                            `test-${recipient.id}`,
                            () =>
                              api.post(
                                `/daily-reports/recipients/${recipient.id}/test`
                              ),
                            "Relatório de teste processado."
                          )
                        }
                      >
                        Enviar teste
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!recipients.length && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    Nenhum gestor cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper className={classes.section}>
        <div className={classes.header}>
          <Typography variant="h6">Prévia do fechamento atual</Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={
              busy === "preview" ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <VisibilityIcon />
              )
            }
            disabled={Boolean(busy)}
            onClick={generatePreview}
          >
            Gerar prévia sem enviar
          </Button>
        </div>
        {preview ? (
          <div className={classes.preview}>{preview}</div>
        ) : (
          <Typography color="textSecondary">
            A prévia calcula os números e salva o snapshot, mas não envia
            nenhuma mensagem.
          </Typography>
        )}
      </Paper>

      <Paper className={classes.section}>
        <Typography variant="h6" gutterBottom>
          Histórico e entregas
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Data</TableCell>
                <TableCell>Período</TableCell>
                <TableCell>Relatório</TableCell>
                <TableCell>Destinatário</TableCell>
                <TableCell>Entrega</TableCell>
                <TableCell>Tentativas</TableCell>
                <TableCell>Ação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {runs
                .flatMap(run =>
                  run.deliveries.length
                    ? run.deliveries.map(delivery => ({ run, delivery }))
                    : [{ run, delivery: null }]
                )
                .map(({ run, delivery }, index) => (
                  <TableRow key={`${run.id}-${delivery?.id || index}`}>
                    <TableCell>{run.reportDate}</TableCell>
                    <TableCell>
                      {dateTime(run.periodStart)} → {dateTime(run.periodEnd)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={`${run.runType === "TEST" ? "TESTE · " : ""}${
                          run.status
                        }`}
                        color={deliveryColor(run.status)}
                      />
                    </TableCell>
                    <TableCell>
                      {delivery
                        ? `${delivery.recipientName} · ${delivery.recipientPhone}`
                        : "Sem entrega"}
                    </TableCell>
                    <TableCell>
                      {delivery ? (
                        <>
                          <Chip
                            size="small"
                            label={delivery.status}
                            color={deliveryColor(delivery.status)}
                          />
                          {delivery.lastError && (
                            <Typography
                              variant="caption"
                              display="block"
                              color="error"
                            >
                              {delivery.lastError}
                            </Typography>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{delivery?.attempts || 0}</TableCell>
                    <TableCell>
                      <div className={classes.actions}>
                        <Button
                          size="small"
                          startIcon={<GetAppIcon />}
                          disabled={Boolean(busy)}
                          onClick={() => downloadCsv(run)}
                        >
                          CSV
                        </Button>
                        {delivery &&
                          ["FAILED_RETRY", "DEAD_LETTER"].includes(
                            delivery.status
                          ) && (
                            <Button
                              size="small"
                              startIcon={<ReplayIcon />}
                              disabled={Boolean(busy)}
                              onClick={() =>
                                runAction(
                                  `retry-${delivery.id}`,
                                  () =>
                                    api.post(
                                      `/daily-reports/deliveries/${delivery.id}/retry`
                                    ),
                                  "Entrega recolocada na fila."
                                )
                              }
                            >
                              Reenviar falha
                            </Button>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              {!runs.length && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    Nenhum fechamento gerado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
};

export default DailyReports;
