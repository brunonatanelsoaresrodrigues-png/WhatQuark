import React, { createContext, useState, useContext, useMemo } from "react";
import PropTypes from "prop-types";
import {
  createMuiTheme,
  ThemeProvider as MUIThemeProvider,
} from "@material-ui/core/styles";
import { CssBaseline } from "@material-ui/core";
import { ptBR } from "@material-ui/core/locale";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("squadchat-theme") === "dark"
  );

  const toggleTheme = () => {
    setDarkMode((prevMode) => {
      const nextMode = !prevMode;
      localStorage.setItem("squadchat-theme", nextMode ? "dark" : "light");
      return nextMode;
    });
  };

  const theme = useMemo(
    () =>
      createMuiTheme(
        {
          palette: {
            type: darkMode ? "dark" : "light",
            primary: {
              light: "#36b7a5",
              main: "#08766c",
              dark: "#00574f",
              contrastText: "#ffffff",
            },
            secondary: {
              light: "#ff897f",
              main: "#ed6358",
              dark: "#bf4138",
              contrastText: "#ffffff",
            },
            background: {
              default: darkMode ? "#101b1a" : "#f3f7f6",
              paper: darkMode ? "#182725" : "#ffffff",
            },
            text: {
              primary: darkMode ? "#eef8f6" : "#183431",
              secondary: darkMode ? "#a8c5c0" : "#607b77",
            },
            divider: darkMode ? "rgba(203, 236, 230, 0.12)" : "#dce9e6",
          },
          typography: {
            fontFamily: '"Inter", "Segoe UI", "Roboto", sans-serif',
            h1: { fontWeight: 800, letterSpacing: "-0.035em" },
            h2: { fontWeight: 800, letterSpacing: "-0.03em" },
            h3: { fontWeight: 750, letterSpacing: "-0.02em" },
            h4: { fontWeight: 750, letterSpacing: "-0.02em" },
            h5: { fontWeight: 700 },
            h6: { fontWeight: 700 },
            button: { fontWeight: 700, textTransform: "none" },
          },
          shape: { borderRadius: 10 },
          props: {
            MuiButton: { disableElevation: true },
            MuiPaper: { elevation: 0 },
          },
          overrides: {
            MuiCssBaseline: {
              "@global": {
                body: {
                  backgroundColor: darkMode ? "#101b1a" : "#f3f7f6",
                },
                "*::-webkit-scrollbar": { width: 8, height: 8 },
                "*::-webkit-scrollbar-thumb": {
                  borderRadius: 8,
                  backgroundColor: darkMode ? "#385b56" : "#b9d2cd",
                },
                "*::-webkit-scrollbar-track": {
                  backgroundColor: "transparent",
                },
              },
            },
            MuiPaper: {
              rounded: { borderRadius: 12 },
              elevation1: {
                border: `1px solid ${
                  darkMode ? "rgba(203, 236, 230, 0.1)" : "#dce9e6"
                }`,
                boxShadow: darkMode
                  ? "0 12px 32px rgba(0, 0, 0, 0.18)"
                  : "0 10px 28px rgba(12, 86, 77, 0.07)",
              },
            },
            MuiCard: {
              root: {
                border: `1px solid ${
                  darkMode ? "rgba(203, 236, 230, 0.1)" : "#dce9e6"
                }`,
                borderRadius: 12,
                boxShadow: darkMode
                  ? "0 12px 32px rgba(0, 0, 0, 0.16)"
                  : "0 10px 28px rgba(12, 86, 77, 0.06)",
              },
            },
            MuiButton: {
              root: { borderRadius: 8, minHeight: 36, letterSpacing: 0 },
              containedPrimary: {
                color: "#ffffff",
                background: "linear-gradient(135deg, #08766c 0%, #078276 100%)",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #005f57 0%, #087f74 100%)",
                },
                "&.Mui-disabled": {
                  color: darkMode ? "#b7cbc7" : "#526a66",
                  background: darkMode ? "#2b403d" : "#dce8e6",
                  boxShadow: "none",
                },
              },
            },
            MuiTableHead: {
              root: { backgroundColor: darkMode ? "#203430" : "#eaf5f3" },
            },
            MuiTableCell: {
              head: {
                color: darkMode ? "#cde8e3" : "#285d56",
                fontWeight: 800,
              },
              root: {
                borderBottomColor: darkMode
                  ? "rgba(203, 236, 230, 0.1)"
                  : "#e3eeec",
              },
            },
            MuiChip: {
              root: { borderRadius: 7, fontWeight: 700 },
            },
            MuiTextField: {
              root: {
                "& .MuiOutlinedInput-root": { borderRadius: 8 },
              },
            },
            MuiTooltip: {
              tooltip: { borderRadius: 7, fontSize: "0.76rem" },
            },
          },
        },
        ptBR
      ),
    [darkMode]
  );

  const contextValue = useMemo(() => ({ darkMode, toggleTheme }), [darkMode]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
};
ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useThemeContext = () => useContext(ThemeContext);
