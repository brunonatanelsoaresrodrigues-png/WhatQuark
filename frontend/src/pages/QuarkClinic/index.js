import React, { useContext, useEffect, useRef, useState } from "react";
import { Redirect, useHistory, useLocation } from "react-router-dom";
import { Button, CircularProgress, Paper, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import CloseIcon from "@material-ui/icons/Close";
import OpenInNewIcon from "@material-ui/icons/OpenInNew";
import RefreshIcon from "@material-ui/icons/Refresh";
import FullscreenIcon from "@material-ui/icons/Fullscreen";
import ErrorOutlineIcon from "@material-ui/icons/ErrorOutline";
import VisibilityIcon from "@material-ui/icons/Visibility";
import VisibilityOffIcon from "@material-ui/icons/VisibilityOff";

import { AuthContext } from "../../context/Auth/AuthContext";
import { getQuarkClinicUrl } from "../../config";
import api from "../../services/api";
import {
  appointmentDateTimeLabel,
  appointmentStatusLabel,
} from "../../services/appointmentDisplay";
import { safeQuarkReturnPath } from "../../services/quarkClinicNavigation";

const useStyles = makeStyles((theme) => ({
  root: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: theme.palette.background.default,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    minHeight: 84,
    padding: theme.spacing(2, 3),
    borderRadius: 0,
    borderLeft: 0,
    borderRight: 0,
    flexShrink: 0,
    [theme.breakpoints.down("xs")]: {
      alignItems: "flex-start",
      flexDirection: "column",
      gap: theme.spacing(1),
    },
  },
  heading: {
    flex: 1,
    minWidth: 0,
  },
  description: {
    color: theme.palette.text.secondary,
  },
  actions: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  selectedAppointment: {
    flexShrink: 0,
    padding: theme.spacing(1.5, 3),
    borderRadius: 0,
    borderLeft: 0,
    borderRight: 0,
    borderTop: 0,
    background: theme.modeTokens.surfaceTint,
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(1.5),
    },
  },
  selectedTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
    [theme.breakpoints.down("xs")]: {
      alignItems: "flex-start",
      flexDirection: "column",
    },
  },
  selectedTitle: {
    display: "flex",
    alignItems: "baseline",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  selectedActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    flexWrap: "wrap",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(120px, 1fr))",
    gap: theme.spacing(1, 2),
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "repeat(2, minmax(120px, 1fr))",
    },
    [theme.breakpoints.down("xs")]: {
      gridTemplateColumns: "1fr",
    },
  },
  detailLabel: {
    display: "block",
    color: theme.palette.text.secondary,
    fontSize: 12,
    lineHeight: 1.4,
  },
  detailValue: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },
  selectedLoading: {
    minHeight: 42,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  selectedError: {
    color: theme.palette.error.main,
  },
  frameContainer: {
    position: "relative",
    flex: 1,
    minHeight: 0,
    backgroundColor: "#fff",
  },
  frame: {
    width: "100%",
    height: "100%",
    display: "block",
    border: 0,
    backgroundColor: "#fff",
  },
  loading: {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(3),
    color: theme.palette.text.secondary,
    textAlign: "center",
    backgroundColor: theme.palette.background.default,
  },
  notice: {
    padding: theme.spacing(0.75, 2),
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.background.paper,
    borderTop: `1px solid ${theme.palette.divider}`,
    flexShrink: 0,
  },
}));

const formatCpf = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 11) return value || "";
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
    6,
    9
  )}-${digits.slice(9)}`;
};

const QuarkClinic = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const history = useHistory();
  const location = useLocation();
  const frameContainerRef = useRef(null);
  const [frameKey, setFrameKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [frameError, setFrameError] = useState(false);
  const [cpfVisible, setCpfVisible] = useState(false);
  const [appointment, setAppointment] = useState(null);
  const [patient, setPatient] = useState(null);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientError, setPatientError] = useState("");
  const [appointmentLoading, setAppointmentLoading] = useState(false);
  const [appointmentError, setAppointmentError] = useState("");
  const [appointmentReload, setAppointmentReload] = useState(0);
  const quarkClinicUrl = getQuarkClinicUrl();
  const search = new URLSearchParams(location.search);
  const appointmentId = search.get("appointmentId") || "";
  const patientId = search.get("patientId") || "";
  const returnTo = safeQuarkReturnPath(search.get("returnTo"));

  useEffect(() => {
    if (!loading) return undefined;

    const timeout = window.setTimeout(() => {
      setLoading(false);
      setFrameError(true);
    }, 12000);

    return () => window.clearTimeout(timeout);
  }, [frameKey, loading]);

  useEffect(() => {
    let active = true;
    if (!appointmentId) {
      setAppointment(null);
      setAppointmentError("");
      return () => {
        active = false;
      };
    }

    setAppointmentLoading(true);
    setAppointmentError("");
    api
      .get(`/quark/clinic/appointments/${encodeURIComponent(appointmentId)}`)
      .then(({ data }) => {
        if (active) setAppointment(data);
      })
      .catch(() => {
        if (active) {
          setAppointment(null);
          setAppointmentError(
            "Não foi possível atualizar esta consulta no Quark."
          );
        }
      })
      .finally(() => {
        if (active) setAppointmentLoading(false);
      });

    return () => {
      active = false;
    };
  }, [appointmentId, appointmentReload]);

  useEffect(() => {
    let active = true;
    if (!patientId) {
      setPatient(null);
      setPatientError("");
      return () => {
        active = false;
      };
    }
    setPatientLoading(true);
    setPatientError("");
    api
      .get(`/quark/clinic/patients/${encodeURIComponent(patientId)}`)
      .then(({ data }) => {
        if (active) setPatient(data);
      })
      .catch(() => {
        if (active) {
          setPatient(null);
          setPatientError("Não foi possível atualizar este cadastro no Quark.");
        }
      })
      .finally(() => {
        if (active) setPatientLoading(false);
      });
    return () => {
      active = false;
    };
  }, [patientId, appointmentReload]);

  if (!user?.canAccessQuarkClinic) {
    return <Redirect to="/tickets" />;
  }

  const reloadFrame = () => {
    setFrameError(false);
    setLoading(true);
    setFrameKey((previousKey) => previousKey + 1);
  };

  const openFullscreen = async () => {
    if (frameContainerRef.current?.requestFullscreen) {
      await frameContainerRef.current.requestFullscreen();
    }
  };

  const closeAppointment = () => history.replace("/quark-clinic");

  const detail = (label, value) => (
    <div>
      <span className={classes.detailLabel}>{label}</span>
      <span className={classes.detailValue}>{value || "Não informado"}</span>
    </div>
  );

  return (
    <div className={classes.root}>
      <Paper className={classes.header} variant="outlined" square>
        <div className={classes.heading}>
          <Typography component="h1" variant="h6">
            Quark Clinic
          </Typography>
          <Typography variant="body2" className={classes.description}>
            Acesso individual. O login é feito e mantido pelo próprio Quark
            neste navegador.
          </Typography>
        </div>
        <div className={classes.actions}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={reloadFrame}
          >
            Recarregar
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FullscreenIcon />}
            onClick={openFullscreen}
          >
            Tela cheia
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            href={quarkClinicUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir separadamente
          </Button>
        </div>
      </Paper>

      {appointmentId && (
        <Paper
          className={classes.selectedAppointment}
          variant="outlined"
          square
        >
          <div className={classes.selectedTop}>
            <div className={classes.selectedTitle}>
              <Typography component="h2" variant="subtitle2">
                Consulta selecionada
              </Typography>
              <Typography variant="caption" color="textSecondary">
                #{appointmentId}
              </Typography>
            </div>
            <div className={classes.selectedActions}>
              {returnTo && (
                <Button
                  size="small"
                  startIcon={<ArrowBackIcon />}
                  onClick={() => history.push(returnTo)}
                >
                  Voltar ao atendimento
                </Button>
              )}
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                disabled={appointmentLoading}
                onClick={() => setAppointmentReload((value) => value + 1)}
              >
                Atualizar
              </Button>
              <Button
                size="small"
                startIcon={<CloseIcon />}
                onClick={closeAppointment}
              >
                Fechar
              </Button>
            </div>
          </div>
          {appointmentLoading ? (
            <div className={classes.selectedLoading}>
              <CircularProgress size={20} />
              <Typography variant="body2">Consultando o Quark…</Typography>
            </div>
          ) : appointmentError ? (
            <Typography variant="body2" className={classes.selectedError}>
              {appointmentError} Use “Atualizar” para tentar novamente.
            </Typography>
          ) : appointment ? (
            <div className={classes.detailGrid}>
              {detail("Paciente", appointment.patientName)}
              {detail(
                "Data e horário",
                appointmentDateTimeLabel(
                  appointment.scheduledAt,
                  appointment.clinicTimezone
                )
              )}
              {detail("Status", appointmentStatusLabel(appointment.status))}
              {detail("Profissional", appointment.professionalName)}
              {detail("Procedimento", appointment.procedureName)}
              {detail("Especialidade", appointment.specialtyName)}
              {detail("Clínica", appointment.clinicName)}
              {detail("Referência no Quark", appointment.appointmentId)}
            </div>
          ) : null}
        </Paper>
      )}

      {patientId && (
        <Paper className={classes.selectedAppointment} variant="outlined" square>
          <div className={classes.selectedTop}>
            <div className={classes.selectedTitle}>
              <Typography component="h2" variant="subtitle2">
                Cadastro selecionado
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Paciente #{patientId}
              </Typography>
            </div>
            <div className={classes.selectedActions}>
              {returnTo && (
                <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => history.push(returnTo)}>
                  Voltar ao atendimento
                </Button>
              )}
              <Button size="small" startIcon={<RefreshIcon />} disabled={patientLoading} onClick={() => setAppointmentReload(value => value + 1)}>
                Atualizar
              </Button>
              {patient?.cpf && (
                <Button
                  size="small"
                  startIcon={cpfVisible ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  onClick={() => setCpfVisible(value => !value)}
                >
                  {cpfVisible ? "Ocultar CPF" : "Exibir CPF"}
                </Button>
              )}
              <Button size="small" startIcon={<CloseIcon />} onClick={closeAppointment}>
                Fechar
              </Button>
            </div>
          </div>
          {patientLoading ? (
            <div className={classes.selectedLoading}><CircularProgress size={20} /><Typography variant="body2">Consultando o Quark…</Typography></div>
          ) : patientError ? (
            <Typography variant="body2" className={classes.selectedError}>{patientError} Use “Atualizar” para tentar novamente.</Typography>
          ) : patient ? (
            <div className={classes.detailGrid}>
              {detail("Paciente", patient.patientName)}
              {detail("CPF", patient.cpf && cpfVisible ? formatCpf(patient.cpf) : "•••.•••.•••-••")}
              {detail("Nascimento", patient.birthDate)}
              {detail("Paciente no Quark", patient.patientId)}
              {detail("Consulta vinculada", patient.appointmentId)}
            </div>
          ) : null}
        </Paper>
      )}

      <div className={classes.frameContainer} ref={frameContainerRef}>
        {(loading || frameError) && (
          <div className={classes.loading}>
            {loading ? (
              <>
                <CircularProgress />
                <Typography variant="body2">Carregando o Quark Clinic…</Typography>
              </>
            ) : (
              <>
                <ErrorOutlineIcon color="error" fontSize="large" />
                <Typography variant="subtitle1" color="textPrimary">
                  O Quark Clinic demorou mais que o esperado.
                </Typography>
                <Typography variant="body2">
                  Verifique a conexão, tente recarregar ou abra a aplicação separadamente.
                </Typography>
                <Button variant="contained" color="primary" startIcon={<RefreshIcon />} onClick={reloadFrame}>
                  Tentar novamente
                </Button>
              </>
            )}
          </div>
        )}
        <iframe
          key={frameKey}
          className={classes.frame}
          src={quarkClinicUrl}
          title="Quark Clinic"
          onLoad={() => {
            setLoading(false);
            setFrameError(false);
          }}
          allow="clipboard-read; clipboard-write; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      <Typography variant="caption" className={classes.notice}>
        Em computador compartilhado, saia do Quark antes de trocar de usuário.
        Se a tela não carregar, use “Abrir separadamente”.
      </Typography>
    </div>
  );
};

export default QuarkClinic;
