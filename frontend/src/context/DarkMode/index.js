import React, { createContext, useState, useContext, useMemo } from "react";
import PropTypes from "prop-types";
import { createTheme, ThemeProvider as MUIThemeProvider } from "@material-ui/core/styles";
import { CssBaseline } from "@material-ui/core";
import { ptBR } from "@material-ui/core/locale";
import { colors, getModeTokens, radii, shadows, spacing, motion, layers, typography } from "../../theme/tokens";
const ThemeContext = createContext();
export const ThemeProvider = ({
  children
}) => {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("squadchat-theme") !== "light");
  const toggleTheme = () => {
    setDarkMode(prevMode => {
      const nextMode = !prevMode;
      localStorage.setItem("squadchat-theme", nextMode ? "dark" : "light");
      return nextMode;
    });
  };
  const theme = useMemo(() => {
    const mode = getModeTokens(darkMode);
    const modeShadows = darkMode ? shadows.dark : shadows.light;
    return createTheme({
      palette: {
        type: darkMode ? "dark" : "light",
        primary: {
          light: colors.brandLight,
          main: darkMode ? colors.brandLight : colors.brand,
          dark: colors.brandDark,
          contrastText: darkMode ? "#072C29" : "#ffffff"
        },
        secondary: {
          light: "#FFB3B9",
          main: darkMode ? "#FFB3B9" : "#B73744",
          dark: "#932B36",
          contrastText: darkMode ? "#3E1017" : "#ffffff"
        },
        success: {
          main: colors.success
        },
        warning: {
          main: colors.warning
        },
        error: {
          main: colors.danger
        },
        info: {
          main: colors.info
        },
        background: {
          default: mode.canvas,
          paper: mode.surface
        },
        text: {
          primary: mode.text,
          secondary: mode.textMuted
        },
        divider: mode.border
      },
      typography: {
        fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 14,
        h1: {
          fontWeight: 650,
          letterSpacing: "-0.035em"
        },
        h2: {
          fontWeight: 650,
          letterSpacing: "-0.03em"
        },
        h3: {
          fontWeight: 650,
          letterSpacing: "-0.025em"
        },
        h4: {
          fontWeight: 650,
          letterSpacing: "-0.025em"
        },
        h5: {
          fontWeight: 600,
          letterSpacing: "-0.018em"
        },
        h6: {
          fontWeight: 600,
          letterSpacing: "-0.012em"
        },
        subtitle1: {
          fontWeight: 550
        },
        subtitle2: {
          fontWeight: 600
        },
        button: {
          fontWeight: 600,
          textTransform: "none",
          letterSpacing: 0
        }
      },
      shape: {
        borderRadius: radii.md
      },
      modeTokens: mode,
      productTokens: {
        colors,
        radii,
        spacing,
        motion,
        layers,
        typography,
        shadows: modeShadows
      },
      transitions: {
        duration: {
          shortest: 120,
          shorter: 160,
          short: 180,
          standard: 220,
          complex: 280,
          enteringScreen: 280,
          leavingScreen: 220
        }
      },
      scrollbarStyles: {
        scrollbarWidth: "thin",
        scrollbarColor: `${mode.borderStrong} transparent`,
        "&::-webkit-scrollbar": {
          width: 8,
          height: 8
        },
        "&::-webkit-scrollbar-thumb": {
          borderRadius: radii.pill,
          backgroundColor: mode.borderStrong
        },
        "&::-webkit-scrollbar-track": {
          backgroundColor: "transparent"
        }
      },
      props: {
        MuiButton: {
          disableElevation: true
        },
        MuiBadge: {
          overlap: "rectangular"
        },
        MuiPaper: {
          elevation: 0
        },
        MuiTextField: {
          variant: "outlined"
        }
      },
      overrides: {
        MuiCardHeader: {
          content: {
            minWidth: 0
          }
        },
        MuiCssBaseline: {
          "@global": {
            "html, body, #root": {
              minHeight: "100%"
            },
            body: {
              colorScheme: darkMode ? "dark" : "light",
              backgroundColor: mode.canvas,
              textRendering: "optimizeLegibility",
              WebkitFontSmoothing: "antialiased"
            },
            "*:focus-visible": {
              outline: `2px solid ${mode.focus}`,
              outlineOffset: 2
            },
            "::selection": {
              background: "rgba(54, 191, 174, .28)"
            },
            "*::-webkit-scrollbar": {
              width: 8,
              height: 8
            },
            "*::-webkit-scrollbar-thumb": {
              borderRadius: 8,
              backgroundColor: mode.borderStrong
            },
            "*::-webkit-scrollbar-track": {
              backgroundColor: "transparent"
            },
            "@media (prefers-reduced-motion: reduce)": {
              "*, *::before, *::after": {
                animationDuration: "0.01ms !important",
                animationIterationCount: "1 !important",
                transitionDuration: "0.01ms !important",
                scrollBehavior: "auto !important"
              }
            },
            ".Toastify__toast": {
              background: mode.surfaceRaised,
              color: mode.text,
              borderRadius: 12,
              border: `1px solid ${mode.border}`,
              boxShadow: modeShadows.raised,
              fontFamily: "inherit",
              padding: 14
            },
            ".Toastify__close-button": {
              color: mode.textMuted
            }
          }
        },
        MuiPaper: {
          rounded: {
            borderRadius: radii.md
          },
          elevation1: {
            border: `1px solid ${mode.border}`,
            boxShadow: modeShadows.soft
          }
        },
        MuiCard: {
          root: {
            border: `1px solid ${mode.border}`,
            borderRadius: radii.md,
            boxShadow: modeShadows.soft
          }
        },
        MuiButton: {
          root: {
            borderRadius: radii.sm,
            minHeight: 38,
            paddingLeft: 16,
            paddingRight: 16,
            transition: "transform 160ms ease, background-color 160ms ease, box-shadow 160ms ease",
            "&:active": {
              transform: "translateY(1px)"
            }
          },
          containedPrimary: {
            color: "#ffffff",
            background: colors.brand,
            "&:hover": {
              background: colors.brandDark,
              boxShadow: "none"
            },
            "&.Mui-disabled": {
              color: mode.textMuted,
              background: mode.surfaceMuted,
              boxShadow: "none"
            }
          },
          outlined: {
            borderColor: mode.borderStrong
          }
        },
        MuiIconButton: {
          root: {
            color: mode.textMuted,
            "& .MuiSvgIcon-root": {
              fontSize: 21
            },
            transition: "background-color 160ms ease, transform 160ms ease",
            "&:active": {
              transform: "scale(.96)"
            }
          }
        },
        MuiDialog: {
          paper: {
            borderRadius: radii.lg,
            boxShadow: modeShadows.raised
          }
        },
        MuiTableHead: {
          root: {
            backgroundColor: mode.surfaceMuted
          }
        },
        MuiTableCell: {
          head: {
            color: mode.textMuted,
            fontSize: ".72rem",
            fontWeight: 600,
            letterSpacing: ".055em",
            textTransform: "uppercase"
          },
          root: {
            borderBottomColor: mode.border
          }
        },
        MuiTableRow: {
          root: {
            transition: "background-color 160ms ease",
            "&:hover": {
              backgroundColor: mode.surfaceMuted
            }
          }
        },
        MuiTableContainer: {
          root: {
            borderRadius: 12
          }
        },
        MuiChip: {
          root: {
            borderRadius: radii.xs,
            fontWeight: 550,
            backgroundColor: mode.surfaceMuted
          },
          colorPrimary: {
            backgroundColor: darkMode ? colors.brandLight : colors.brand
          },
          colorSecondary: {
            backgroundColor: darkMode ? "#FFB3B9" : "#B73744"
          }
        },
        MuiTextField: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: radii.sm,
              backgroundColor: mode.surface
            }
          }
        },
        MuiOutlinedInput: {
          root: {
            borderRadius: radii.sm,
            "&.Mui-focused": {
              boxShadow: modeShadows.focus
            }
          },
          notchedOutline: {
            borderColor: mode.borderStrong
          }
        },
        MuiTab: {
          root: {
            minHeight: 48,
            fontSize: ".78rem",
            fontWeight: 600,
            textTransform: "none"
          }
        },
        MuiTabs: {
          indicator: {
            height: 3,
            borderRadius: "3px 3px 0 0"
          }
        },
        MuiMenu: {
          paper: {
            border: `1px solid ${mode.border}`
          }
        },
        MuiTooltip: {
          tooltip: {
            borderRadius: radii.xs,
            fontSize: "0.76rem"
          }
        }
      }
    }, ptBR);
  }, [darkMode]);
  const contextValue = useMemo(() => ({
    darkMode,
    toggleTheme
  }), [darkMode]);
  return <ThemeContext.Provider value={contextValue}>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>;
};
ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired
};
export const useThemeContext = () => useContext(ThemeContext);
