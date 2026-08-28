import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "@material-ui/core/styles";
import {
  BarChart,
  CartesianGrid,
  Bar,
  XAxis,
  YAxis,
  Label,
  ResponsiveContainer
} from "recharts";
import { startOfHour, parseISO, format } from "date-fns";

import { i18n } from "../../translate/i18n";

import Title from "./Title";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const Chart = () => {
  const theme = useTheme();

  const [data, setData] = useState(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await api.get("/ticket-metrics/daily");
        if (active) setData(response.data);
      } catch (e) {
        if (active) toastError(e);
      }
    };
    load();
    const timer = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const chartData = data?.hours || [];
  return (
    <React.Fragment>
      <Title>{`Atendimentos de hoje: ${data?.total ?? "…"} · ${
        data?.timezone || "horário da clínica"
      }`}</Title>
      <ResponsiveContainer>
        <BarChart
          data={chartData}
          barSize={40}
          width={730}
          height={250}
          margin={{
            top: 16,
            right: 16,
            bottom: 0,
            left: 24
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" stroke={theme.palette.text.secondary} />
          <YAxis
            type="number"
            allowDecimals={false}
            stroke={theme.palette.text.secondary}
          >
            <Label
              angle={270}
              position="left"
              style={{ textAnchor: "middle", fill: theme.palette.text.primary }}
            >
              Atendimentos
            </Label>
          </YAxis>
          <Bar dataKey="amount" fill={theme.palette.primary.main} />
        </BarChart>
      </ResponsiveContainer>
    </React.Fragment>
  );
};

export default Chart;
