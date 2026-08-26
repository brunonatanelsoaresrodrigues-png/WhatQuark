import React, { useEffect, useState } from "react";

import FormControl from "@material-ui/core/FormControl";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const TicketsAssigneeSelect = ({ value, onChange, canViewOthers }) => {
  const [assignees, setAssignees] = useState([]);

  useEffect(() => {
    let active = true;

    const loadAssignees = async () => {
      try {
        const { data } = await api.get("/users/assignees");
        if (active) setAssignees(data);
      } catch (err) {
        toastError(err);
      }
    };

    loadAssignees();

    return () => {
      active = false;
    };
  }, [canViewOthers]);

  const selectedUser = value.startsWith("user:")
    ? assignees.find(user => value === `user:${user.id}`)
    : null;

  const renderValue = () => {
    if (value === "all") return i18n.t("ticketsAssigneeSelect.all");
    if (value === "unassigned") {
      return i18n.t("ticketsAssigneeSelect.unassigned");
    }
    if (selectedUser) return selectedUser.name;
    return i18n.t("ticketsAssigneeSelect.me");
  };

  return (
    <div style={{ width: 150, marginTop: -4 }}>
      <FormControl fullWidth margin="dense">
        <Select
          displayEmpty
          variant="outlined"
          value={value}
          onChange={event => onChange(event.target.value)}
          renderValue={renderValue}
          MenuProps={{
            anchorOrigin: { vertical: "bottom", horizontal: "left" },
            transformOrigin: { vertical: "top", horizontal: "left" },
            getContentAnchorEl: null
          }}
        >
          {canViewOthers && (
            <MenuItem dense value="all">
              {i18n.t("ticketsAssigneeSelect.all")}
            </MenuItem>
          )}
          <MenuItem dense value="me">
            {i18n.t("ticketsAssigneeSelect.me")}
          </MenuItem>
          <MenuItem dense value="unassigned">
            {i18n.t("ticketsAssigneeSelect.unassigned")}
          </MenuItem>
          {canViewOthers &&
            assignees.map(user => (
              <MenuItem dense key={user.id} value={`user:${user.id}`}>
                {user.name}
              </MenuItem>
            ))}
        </Select>
      </FormControl>
    </div>
  );
};

export default TicketsAssigneeSelect;
