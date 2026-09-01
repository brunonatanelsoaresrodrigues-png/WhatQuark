import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Skeleton from "@material-ui/lab/Skeleton";

const useStyles = makeStyles(theme => ({
  card: {
    display: "flex",
    minHeight: 78,
    gap: theme.spacing(1.1),
    marginBottom: theme.spacing(0.75),
    padding: theme.spacing(1.25),
    background: theme.modeTokens.surfaceMuted,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.productTokens.radii.xs
  },
  content: {
    flex: 1,
    minWidth: 0
  },
  line: {
    marginBottom: theme.spacing(0.75)
  },
  meta: {
    display: "flex",
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(1)
  }
}));

const TicketsSkeleton = () => {
  const classes = useStyles();
  return (
    <div role="status" aria-label="Carregando atendimentos">
      {[72, 58, 80, 64].map((width, index) => (
        <div className={classes.card} key={`${width}-${index}`}>
          <Skeleton animation="wave" variant="circle" width={40} height={40} />
          <div className={classes.content}>
            <Skeleton className={classes.line} height={16} width={`${width}%`} />
            <Skeleton height={14} width={`${Math.max(48, width - 8)}%`} />
            <div className={classes.meta}>
              <Skeleton height={18} width={66} />
              <Skeleton height={18} width={82} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TicketsSkeleton;
