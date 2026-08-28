import React, { useState, useEffect } from "react";
import openSocket from "../../services/socket-io";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Container from "@material-ui/core/Container";
import Select from "@material-ui/core/Select";
import TextField from "@material-ui/core/TextField";
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
  margin: {
    margin: theme.spacing(1)
  }
}));

const Settings = () => {
  const classes = useStyles();

  const [settings, setSettings] = useState([]);

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

  const getSettingValue = key => {
    return settings.find(s => s.key === key)?.value || "";
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

        <Paper className={classes.paper}>
          <TextField
            id="api-token-setting"
            InputProps={{ readOnly: true }}
            label="Token Api"
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
