import React from "react";
import Typography from "@material-ui/core/Typography";
import { useLocation } from "react-router-dom";

const descriptions = {
  "/connections":
    "Gerencie os canais e acompanhe a disponibilidade das conexões.",
  "/contacts": "Pacientes, clientes e informações de contato em um só lugar.",
  "/quickanswers":
    "Organize respostas para tornar o atendimento mais consistente.",
  "/users": "Organize sua equipe, os acessos e as responsabilidades.",
  "/queues": "Distribua o atendimento entre os setores da sua operação."
};

export default function Title(props) {
  const { pathname } = useLocation();
  return (
    <div style={{ minWidth: 160 }}>
      <Typography component="h1" variant="h5" color="textPrimary">
        {props.children}
      </Typography>
      {descriptions[pathname.toLowerCase()] && (
        <Typography
          variant="body2"
          color="textSecondary"
          style={{ marginTop: 6, maxWidth: 460 }}
        >
          {descriptions[pathname.toLowerCase()]}
        </Typography>
      )}
    </div>
  );
}
