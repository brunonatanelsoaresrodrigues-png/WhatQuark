import React from "react";

import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
  contactsHeader: {
    display: "flex",
    alignItems: "center",
    minHeight: 64,
    marginBottom: theme.spacing(2),
    padding: theme.spacing(0, 0.5),
    gap: theme.spacing(2),
    flexWrap: "wrap",
    [theme.breakpoints.down("xs")]: {
      alignItems: "flex-start",
      flexDirection: "column",
      gap: theme.spacing(1)
    }
  }
}));

const MainHeader = ({ children }) => {
  const classes = useStyles();

  return <div className={classes.contactsHeader}>{children}</div>;
};

export default MainHeader;
