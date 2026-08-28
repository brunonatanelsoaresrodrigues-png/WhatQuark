import React, { useEffect, useState } from "react";
import { TextField, MenuItem } from "@material-ui/core";
import api from "../../services/api";
import toastError from "../../errors/toastError";

export default function TicketsAssigneeSelect({
  value,
  onChange,
  canViewOthers
}) {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    let active = true;
    api
      .get("/users/assignees")
      .then(({ data }) => {
        if (active) setUsers(Array.isArray(data) ? data : []);
      })
      .catch(error => {
        if (active) toastError(error);
      });
    return () => {
      active = false;
    };
  }, [canViewOthers]);
  return (
    <TextField
      id="ticket-assignee-filter"
      select
      label="Atendente"
      variant="outlined"
      size="small"
      value={value}
      onChange={event => onChange(event.target.value)}
      style={{ minWidth: 144, flex: 1 }}
    >
      <MenuItem value="default">Meus e aguardando</MenuItem>
      {canViewOthers && <MenuItem value="all">Todos</MenuItem>}
      <MenuItem value="me">Somente meus</MenuItem>
      <MenuItem value="unassigned">Sem atendente</MenuItem>
      {canViewOthers &&
        users.map(user => (
          <MenuItem key={user.id} value={`user:${user.id}`}>
            {user.name}
          </MenuItem>
        ))}
    </TextField>
  );
}
