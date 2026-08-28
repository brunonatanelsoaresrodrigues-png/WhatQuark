import React from "react";
import { Avatar, makeStyles } from "@material-ui/core";
const useStyles = makeStyles(theme => ({
  root: {
    width: 38,
    height: 38,
    flexShrink: 0,
    color: theme.modeTokens.avatarText,
    background: theme.modeTokens.avatar,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: ".02em"
  }
}));
export default function ContactAvatar({
  contact,
  className = ""
}) {
  const classes = useStyles();
  const initials = (contact?.name || "?").trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join("").toLocaleUpperCase();
  return <Avatar src={contact?.profilePicUrl} alt="" className={`${classes.root} ${className}`}>
      {initials}
    </Avatar>;
}
