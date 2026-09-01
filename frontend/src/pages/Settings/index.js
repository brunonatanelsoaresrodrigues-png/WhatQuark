import React, { useState, useEffect } from "react";
import openSocket from "../../services/socket-io";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Container from "@material-ui/core/Container";
import Select from "@material-ui/core/Select";
import TextField from "@material-ui/core/TextField";
import IconButton from "@material-ui/core/IconButton";
import InputAdornment from "@material-ui/core/InputAdornment";
import Tooltip from "@material-ui/core/Tooltip";
import FileCopyOutlinedIcon from "@material-ui/icons/FileCopyOutlined";
import VisibilityIcon from "@material-ui/icons/Visibility";
import VisibilityOffIcon from "@material-ui/icons/VisibilityOff";
import { toast } from "react-toastify";

import api from "../../services/api";
import { i18n } from "../../translate/i18n.js";
import toastError from "../../errors/toastError";
import PageHeading from "../../components/PageHeading";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    alignItems: "flex-start",
    padding: theme.spacing(4, 2),
    [theme.breakpoints.down("xs")]: { padding: theme.spacing(2, 0) }
  },

  paper: {
    padding: theme.spacing(3),
    display: "flex",
    alignItems: "center",
    marginBottom: 20,
    gap: 16,
    flexWrap: "wrap",
    border: `1px solid ${theme.palette.divider}`
  },

  settingOption: {
    marginLeft: "auto"
  },
  settingCopy: {
    flex: "1 1 280px"
  },
  sectionTitle: {
    margin: theme.spacing(3, 0, 1),
    fontWeight: 650
  },
  margin: {
    margin: theme.spacing(1)
  }
}));

const Settings = () => {
  const classes = useStyles();

  const [settings, setSettings] = useState([]);
  const [tokenVisible, setTokenVisible] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data } = await api.get("/settings");
        setSettings(data);
      } catch (err) {
        toastError(err);
      }
    };
    fetchSession();
  }, []);

  useEffect(() => {
    const socket = openSocket();

    socket.on("settings", data => {
      if (data.action === "update") {
        setSettings(prevState => {
          const aux = [...prevState];
          const settingIndex = aux.findIndex(s => s.key === data.setting.key);
          if (settingIndex >= 0) aux[settingIndex] = data.setting;
          else aux.push(data.setting);
          return aux;
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleChangeSetting = async e => {
    const selectedValue = e.target.value;
    const settingKey = e.target.name;

    try {
      await api.put(`/settings/${settingKey}`, {
        value: selectedValue
      });
      toast.success(i18n.t("settings.success"));
    } catch (err) {
      toastError(err);
    }
  };

  const updateLocalSetting = e => {
    const settingKey = e.target.name;
    const value = e.target.value;
    setSettings(previous => {
      const found = previous.some(item => item.key === settingKey);
      return found
        ? previous.map(item =>
            item.key === settingKey ? { ...item, value } : item
          )
        : [...previous, { key: settingKey, value }];
    });
  };

  const getSettingValue = key => {
    return settings.find(s => s.key === key)?.value || "";
  };

  const copyApiToken = async () => {
    const token = getSettingValue("userApiToken");
    if (!token) return;

    try {
      await navigator.clipboard.writeText(token);
      toast.success("Token copiado com segurança.");
    } catch (_) {
      toast.error("Não foi possível copiar o token neste navegador.");
    }
  };

  return (
    <div className={classes.root}>
      <Container maxWidth="md">
        <PageHeading
          title={i18n.t("settings.title")}
          eyebrow="Administração"
          description="Preferências gerais e credenciais de integração da sua operação."
        />
        <Paper className={classes.paper}>
          <Typography variant="body1">
            {i18n.t("settings.settings.userCreation.name")}
          </Typography>
          <Select
            margin="dense"
            variant="outlined"
            native
            id="userCreation-setting"
            name="userCreation"
            inputProps={{ "aria-label": "Permitir criação de usuários" }}
            value={getSettingValue("userCreation")}
            className={classes.settingOption}
            onChange={handleChangeSetting}
          >
            <option value="enabled">
              {i18n.t("settings.settings.userCreation.options.enabled")}
            </option>
            <option value="disabled">
              {i18n.t("settings.settings.userCreation.options.disabled")}
            </option>
          </Select>
        </Paper>

        <Typography className={classes.sectionTitle} variant="h6">
          Avaliação do atendimento
        </Typography>
        <Paper className={classes.paper}>
          <div className={classes.settingCopy}>
            <Typography variant="body1">Enviar pesquisa de satisfação</Typography>
            <Typography variant="body2" color="textSecondary">
              Envia após resolver o ticket ou após o encerramento automático por inatividade.
            </Typography>
          </div>
          <Select
            margin="dense"
            variant="outlined"
            native
            name="serviceRatingEnabled"
            value={getSettingValue("serviceRatingEnabled") || "enabled"}
            className={classes.settingOption}
            onChange={event => {
              updateLocalSetting(event);
              handleChangeSetting(event);
            }}
          >
            <option value="enabled">Ativada</option>
            <option value="disabled">Desativada</option>
          </Select>
        </Paper>
        <Paper className={classes.paper}>
          <TextField
            label="Validade da pesquisa (horas)"
            name="serviceRatingExpiryHours"
            type="number"
            variant="outlined"
            margin="dense"
            inputProps={{ min: 1, max: 168 }}
            value={getSettingValue("serviceRatingExpiryHours") || "48"}
            onChange={updateLocalSetting}
            onBlur={handleChangeSetting}
          />
          <TextField
            label="Intervalo por paciente (horas)"
            name="serviceRatingCooldownHours"
            type="number"
            variant="outlined"
            margin="dense"
            inputProps={{ min: 1, max: 720 }}
            value={getSettingValue("serviceRatingCooldownHours") || "12"}
            onChange={updateLocalSetting}
            onBlur={handleChangeSetting}
          />
        </Paper>
        <Paper className={classes.paper}>
          <TextField
            label="Mensagem da pesquisa"
            name="serviceRatingMessage"
            variant="outlined"
            margin="dense"
            multiline
            minRows={3}
            fullWidth
            helperText="A resposta deve ser apenas um número de 0 a 5."
            value={getSettingValue("serviceRatingMessage")}
            onChange={updateLocalSetting}
            onBlur={handleChangeSetting}
          />
        </Paper>
        <Paper className={classes.paper}>
          <TextField
            label="Mensagem de agradecimento"
            name="serviceRatingThankYouMessage"
            variant="outlined"
            margin="dense"
            multiline
            minRows={2}
            fullWidth
            value={getSettingValue("serviceRatingThankYouMessage")}
            onChange={updateLocalSetting}
            onBlur={handleChangeSetting}
          />
        </Paper>

        <Paper className={classes.paper}>
          <TextField
            id="api-token-setting"
            type={tokenVisible ? "text" : "password"}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={tokenVisible ? "Ocultar token" : "Exibir token"}>
                    <IconButton
                      edge="end"
                      aria-label={tokenVisible ? "Ocultar token da API" : "Exibir token da API"}
                      onClick={() => setTokenVisible(value => !value)}
                    >
                      {tokenVisible ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Copiar token">
                    <IconButton
                      edge="end"
                      aria-label="Copiar token da API"
                      onClick={copyApiToken}
                    >
                      <FileCopyOutlinedIcon />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              )
            }}
            label="Token da API"
            helperText="Mantido oculto por padrão. Não compartilhe esta credencial."
            margin="dense"
            variant="outlined"
            fullWidth
            value={getSettingValue("userApiToken")}
          />
        </Paper>
      </Container>
    </div>
  );
};

export default Settings;
