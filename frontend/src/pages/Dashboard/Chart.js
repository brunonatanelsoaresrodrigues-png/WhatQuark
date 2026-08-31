import React from "react";
import { Box, Typography, makeStyles, useMediaQuery } from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";
import BarChartOutlinedIcon from "@material-ui/icons/BarChartOutlined";
import {
  BarChart,
  CartesianGrid,
  Bar,
  XAxis,
  YAxis,
  Legend,
  ResponsiveContainer,
  Tooltip
} from "recharts";

const useStyles = makeStyles(theme => ({
  empty: {
    display: "grid",
    height: "100%",
    minHeight: 220,
    padding: theme.spacing(3),
    color: theme.palette.text.secondary,
    placeItems: "center",
    textAlign: "center"
  },
  emptyIcon: {
    display: "grid",
    width: 48,
    height: 48,
    margin: "0 auto 12px",
    color: theme.statusTokens.info.fg,
    background: theme.statusTokens.info.bg,
    border: `1px solid ${theme.statusTokens.info.border}`,
    borderRadius: theme.productTokens.radii.md,
    placeItems: "center"
  },
  emptyTitle: {
    color: theme.palette.text.primary,
    fontWeight: 650
  },
  emptyText: {
    maxWidth: 320,
    marginTop: theme.spacing(0.5),
    fontSize: theme.productTokens.typography.bodySM.fontSize
  }
}));

const Chart = ({ data = [] }) => {
  const classes = useStyles();
  const theme = useTheme();
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const hasData = data.some(
    item => Number(item?.entries || 0) > 0 || Number(item?.resolved || 0) > 0
  );

  if (!hasData)
    return (
      <div className={classes.empty} role="status">
        <Box>
          <span className={classes.emptyIcon} aria-hidden="true">
            <BarChartOutlinedIcon />
          </span>
          <Typography className={classes.emptyTitle} variant="subtitle1">
            O movimento do dia aparecerá aqui
          </Typography>
          <Typography className={classes.emptyText} color="textSecondary">
            Ainda não há entradas ou finalizações no período selecionado.
          </Typography>
        </Box>
      </div>
    );

  return (
    <div
      role="img"
      aria-label="Gráfico de entradas e atendimentos finalizados por hora"
      style={{ width: "100%", height: "100%" }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          barGap={2}
          barCategoryGap="28%"
          margin={{
            top: 12,
            right: 8,
            bottom: 2,
            left: -14
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme.palette.divider}
            vertical={false}
          />
          <XAxis
            dataKey="time"
            stroke={theme.palette.text.secondary}
            tickLine={false}
            axisLine={false}
            interval={1}
            fontSize={11}
          />
          <YAxis
            type="number"
            allowDecimals={false}
            stroke={theme.palette.text.secondary}
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <Tooltip
            cursor={{ fill: theme.palette.action.hover }}
            contentStyle={{
              color: theme.palette.text.primary,
              background: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: theme.productTokens.radii.sm,
              boxShadow: theme.productTokens.shadows.raised
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="entries"
            name="Entradas"
            fill={theme.chartPalette[0]}
            radius={[4, 4, 0, 0]}
            maxBarSize={16}
            isAnimationActive={!reduceMotion}
            animationDuration={theme.productTokens.motion.duration.transition}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="resolved"
            name="Finalizados"
            fill={theme.chartPalette[4]}
            radius={[4, 4, 0, 0]}
            maxBarSize={16}
            isAnimationActive={!reduceMotion}
            animationDuration={theme.productTokens.motion.duration.transition}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default Chart;
