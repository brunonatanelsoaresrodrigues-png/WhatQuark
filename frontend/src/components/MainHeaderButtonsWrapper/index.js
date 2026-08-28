import React from "react";

import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
  MainHeaderButtonsWrapper: {
    flex: "none",
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    "& > *": {
      margin: "0 !important"
    },
    [theme.breakpoints.down("xs")]: { marginLeft: 0, width: "100%" }
  }
}));

const MainHeaderButtonsWrapper = ({ children }) => {
  const classes = useStyles();

  return <div className={classes.MainHeaderButtonsWrapper}>{children}</div>;
};

export default MainHeaderButtonsWrapper;
