import React from "react";
import { useTheme } from "@material-ui/core/styles";
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

const Chart = ({ data = [] }) => {
  const theme = useTheme();
  return (
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
              borderRadius: 10,
              boxShadow: theme.shadows[3]
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="entries"
            name="Entradas"
            fill="#0C8C92"
            radius={[4, 4, 0, 0]}
            maxBarSize={16}
            isAnimationActive={false}
          />
          <Bar
            dataKey="resolved"
            name="Finalizados"
            fill="#77C95B"
            radius={[4, 4, 0, 0]}
            maxBarSize={16}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
  );
};

export default Chart;
