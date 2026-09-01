import React from "react";
import { Grid, Paper } from "@material-ui/core";
import Skeleton from "@material-ui/lab/Skeleton";

export default function PageSkeleton({ messages = false }) {
  if (messages)
    return (
      <div
        role="status"
        aria-label="Carregando mensagens"
        style={{ width: "100%", padding: 8 }}
      >
        {[0, 1, 2, 3].map(index => (
          <Skeleton
            key={index}
            variant="rect"
            animation="wave"
            height={52}
            width={index % 2 ? "52%" : "62%"}
            style={{
              borderRadius: 14,
              margin: "16px 0",
              marginLeft: index % 2 ? "auto" : 0
            }}
          />
        ))}
      </div>
    );
  return (
    <div role="status" aria-label="Carregando dados" style={{ padding: 24 }}>
      <Skeleton width="35%" height={40} style={{ marginBottom: 24 }} />
      <Grid container spacing={2}>
        {[0, 1, 2].map(index => (
          <Grid item xs={12} sm={4} key={index}>
            <Paper style={{ padding: 24 }}>
              <Skeleton width="65%" />
              <Skeleton height={64} width="40%" />
            </Paper>
          </Grid>
        ))}
      </Grid>
      <Skeleton
        variant="rect"
        height={260}
        style={{ borderRadius: 14, marginTop: 24 }}
      />
    </div>
  );
}
