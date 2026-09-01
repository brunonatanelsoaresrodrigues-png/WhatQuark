import React from "react";
import Table from "@material-ui/core/Table";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
  table: {
    [theme.breakpoints.down("xs")]: {
      display: "block",
      width: "100%",
      minWidth: 0,
      "& thead": { display: "none" },
      "& tbody": {
        display: "grid",
        gap: theme.spacing(1.25),
        padding: theme.spacing(1.25)
      },
      "& tr": {
        display: "grid",
        width: "100%",
        overflow: "hidden",
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: theme.shape.borderRadius * 1.5,
        background: theme.palette.background.paper,
        boxShadow: theme.shadows[1],
        transition: theme.transitions.create(["border-color", "box-shadow"], {
          duration: theme.transitions.duration.shorter
        })
      },
      "& tr:hover": {
        borderColor: theme.palette.primary.main,
        boxShadow: theme.shadows[2]
      },
      "& td": {
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: theme.spacing(2),
        width: "100%",
        minHeight: 42,
        padding: theme.spacing(1, 1.5),
        textAlign: "right",
        borderBottom: `1px solid ${theme.palette.divider}`,
        overflowWrap: "anywhere"
      },
      "& td:last-child": { borderBottom: 0 },
      "& td[data-label]::before": {
        content: "attr(data-label)",
        flex: "0 0 38%",
        color: theme.palette.text.secondary,
        fontSize: ".75rem",
        fontWeight: 600,
        textAlign: "left"
      },
      "& td[data-mobile-primary]": {
        justifyContent: "flex-start",
        paddingTop: theme.spacing(1.5),
        paddingBottom: theme.spacing(1.5),
        color: theme.palette.text.primary,
        fontSize: ".875rem",
        fontWeight: 600,
        textAlign: "left"
      },
      "& td[data-mobile-primary]::before": { display: "none" },
      "& td[data-mobile-actions]": {
        justifyContent: "flex-end",
        background: theme.palette.action.hover
      },
      "& td[data-mobile-actions]::before": { marginRight: "auto" },
      "& td[data-mobile-hide]": { display: "none" },
      "& td[colspan]": {
        display: "block",
        padding: theme.spacing(3, 2),
        textAlign: "center",
        borderBottom: 0
      },
      "& .MuiSkeleton-root": { maxWidth: "100%" }
    }
  }
}));

const ResponsiveTable = ({ className = "", ...props }) => {
  const classes = useStyles();
  const tableClassName = [classes.table, className].filter(Boolean).join(" ");

  return <Table {...props} className={tableClassName} />;
};

export default ResponsiveTable;
