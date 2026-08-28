import React from "react";
import { Typography, makeStyles } from "@material-ui/core";
const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24
  },
  title: {
    fontWeight: 600,
    letterSpacing: "-.025em"
  },
  description: {
    marginTop: 6,
    maxWidth: 640
  },
  eyebrow: {
    display: "block",
    color: theme.palette.primary.main,
    fontSize: 11,
    fontWeight: 550,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    marginBottom: 6
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap"
  }
}));
export default function PageHeading({
  title,
  description,
  eyebrow,
  actions
}) {
  const classes = useStyles();
  return <header className={classes.root}>
      <div>
        {eyebrow && <span className={classes.eyebrow}>{eyebrow}</span>}
        <Typography component="h1" variant="h5" className={classes.title}>
          {title}
        </Typography>
        {description && <Typography variant="body2" color="textSecondary" className={classes.description}>
            {description}
          </Typography>}
      </div>
      {actions && <div className={classes.actions}>{actions}</div>}
    </header>;
}
