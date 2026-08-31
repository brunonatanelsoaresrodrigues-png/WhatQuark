import React, { createContext, useState, useContext, useMemo } from "react";
import PropTypes from "prop-types";
import { createTheme, ThemeProvider as MUIThemeProvider } from "@material-ui/core/styles";
import { CssBaseline } from "@material-ui/core";
import { ptBR } from "@material-ui/core/locale";
import { colors, getModeTokens, getStatusTokens, getChartPalette, getGradients, withAlpha, radii, shadows, spacing, motion, layers, typography } from "../../theme/tokens";
const ThemeContext = createContext();
const STORAGE_KEY = "squadchat-theme";

// Primeira visita segue o sistema; a partir da primeira troca manual, a escolha
// salva manda. O escuro continua sendo o padrao quando o sistema nao declara
// preferencia alguma.
const readInitialMode = () => {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    stored = null;
  }
  if (stored === "light") return false;
  if (stored === "dark") return true;
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return !window.matchMedia("(prefers-color-scheme: light)").matches;
  }
  return true;
};

// As 25 elevacoes do Material UI passam a sair da rampa do produto, para que
// qualquer `elevation={n}` fique coerente com as sombras proprias.
const buildShadowScale = ramp => {
  const scale = ["none"];
  for (let level = 1; level < 25; level += 1) {
    if (level === 1) scale.push(ramp.rest);
    else if (level <= 3) scale.push(ramp.soft);
    else if (level <= 7) scale.push(ramp.hover);
    else if (level <= 15) scale.push(ramp.raised);
    else scale.push(ramp.overlay);
  }
  return scale;
};

export const ThemeProvider = ({
  children
}) => {
  const [darkMode, setDarkMode] = useState(readInitialMode);
  const toggleTheme = () => {
    setDarkMode(prevMode => {
      const nextMode = !prevMode;
      try {
        localStorage.setItem(STORAGE_KEY, nextMode ? "dark" : "light");
      } catch (err) {
        // Armazenamento indisponivel (aba anonima, cookies bloqueados): a troca
        // vale para a sessao atual e nao persiste.
      }
      return nextMode;
    });
  };
  const theme = useMemo(() => {
    const mode = getModeTokens(darkMode);
    const modeShadows = darkMode ? shadows.dark : shadows.light;
    const status = getStatusTokens(darkMode);
    const chartPalette = getChartPalette(darkMode);
    const gradients = getGradients(darkMode);
    return createTheme({
      palette: {
        type: darkMode ? "dark" : "light",
        primary: {
          light: colors.brandLight,
          main: darkMode ? colors.brandLight : colors.brand,
          dark: colors.brandDark,
          contrastText: darkMode ? colors.onBrandDark : colors.onBrandLight
        },
        secondary: {
          light: colors.accentLight,
          main: darkMode ? colors.accentLight : colors.accent,
          dark: colors.accentDark,
          contrastText: darkMode ? colors.onAccentDark : colors.onAccentLight
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
        action: {
          hover: mode.hover,
          selected: mode.selected
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
      shadows: buildShadowScale(modeShadows),
      modeTokens: mode,
      statusTokens: status,
      chartPalette,
      gradients,
      productTokens: {
        colors,
        radii,
        spacing,
        motion,
        layers,
        typography,
        shadows: modeShadows,
        status,
        chartPalette,
        gradients,
        withAlpha,
        // Keyframes globais, declarados em src/theme/global.css. Componentes
        // referenciam pelo nome, sem redeclarar a animacao em cada stylesheet.
        animations: {
          arrive: `sc-arrive ${motion.duration.micro}ms ${motion.easing} both`
        }
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
      // Painel rolavel das paginas de tabela. Antes este bloco estava copiado,
      // identico, em cada uma das cinco paginas de listagem.
      panelStyles: {
        flex: 1,
        padding: 0,
        overflow: "auto",
        borderRadius: radii.md,
        minHeight: 160,
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
        },
        MuiSkeleton: {
          animation: "wave"
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
            // A fonte e os keyframes ficam em src/theme/global.css: nomes de
            // @keyframes declarados aqui passariam pelo escopo do JSS, e o
            // componente que os referencia por nome nao os encontraria.
            "html, body, #root": {
              minHeight: "100%"
            },
            body: {
              colorScheme: darkMode ? "dark" : "light",
              backgroundColor: mode.canvas,
              textRendering: "optimizeLegibility",
              WebkitFontSmoothing: "antialiased",
              MozOsxFontSmoothing: "grayscale",
              // A Inter e variavel: as ligaduras contextuais e o corte de zero
              // so aparecem com as features ligadas explicitamente.
              fontFeatureSettings: '"liga" 1, "calt" 1, "cv05" 1'
            },
            "*:focus-visible": {
              outline: `2px solid ${mode.focus}`,
              outlineOffset: 2
            },
            "::selection": {
              background: mode.selection
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
              background: mode.surfaceOverlay,
              color: mode.text,
              borderRadius: radii.md,
              border: `1px solid ${mode.border}`,
              boxShadow: modeShadows.overlay,
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
          outlined: {
            borderColor: mode.border
          },
          elevation1: {
            border: `1px solid ${mode.border}`,
            boxShadow: modeShadows.rest
          }
        },
        MuiCard: {
          root: {
            border: `1px solid ${mode.border}`,
            borderRadius: radii.md,
            boxShadow: modeShadows.rest
          }
        },
        MuiButton: {
          root: {
            borderRadius: radii.sm,
            minHeight: 38,
            paddingLeft: 16,
            paddingRight: 16,
            transition: `transform ${motion.duration.micro}ms ${motion.easing}, background-color ${motion.duration.micro}ms ${motion.easing}, box-shadow ${motion.duration.micro}ms ${motion.easing}`,
            "&:active": {
              transform: "translateY(1px)"
            },
            "&.Mui-focusVisible": {
              boxShadow: modeShadows.focus
            }
          },
          containedPrimary: {
            // O tom escuro do teal so tem contraste suficiente com texto branco.
            // No tema escuro a superficie precisa clarear junto com a paleta.
            color: darkMode ? colors.onBrandDark : colors.onBrandLight,
            background: darkMode ? colors.brandLight : colors.brand,
            "&:hover": {
              background: darkMode ? colors.brandLightHover : colors.brandDark,
              boxShadow: modeShadows.rest
            },
            "&.Mui-disabled": {
              color: mode.textMuted,
              background: mode.surfaceMuted,
              boxShadow: "none"
            }
          },
          outlined: {
            borderColor: mode.borderStrong,
            "&:hover": {
              borderColor: mode.textMuted,
              background: mode.hover
            }
          },
          text: {
            "&:hover": {
              background: mode.hover
            }
          }
        },
        MuiIconButton: {
          root: {
            color: mode.textMuted,
            "& .MuiSvgIcon-root": {
              fontSize: 21
            },
            transition: `background-color ${motion.duration.micro}ms ${motion.easing}, color ${motion.duration.micro}ms ${motion.easing}, transform ${motion.duration.micro}ms ${motion.easing}`,
            "&:hover": {
              color: mode.text,
              background: mode.hover
            },
            "&:active": {
              transform: "scale(.96)"
            }
          }
        },
        MuiSvgIcon: {
          root: {
            fontSize: 20
          },
          fontSizeSmall: {
            fontSize: 17
          },
          fontSizeLarge: {
            fontSize: 28
          }
        },
        MuiDrawer: {
          paper: {
            backgroundImage: "none",
            borderColor: mode.border
          }
        },
        MuiAppBar: {
          root: {
            backgroundImage: "none"
          }
        },
        MuiListItem: {
          root: {
            "&.Mui-selected, &.Mui-selected:hover": {
              backgroundColor: mode.selected
            }
          },
          button: {
            transition: `background-color ${motion.duration.micro}ms ${motion.easing}`,
            "&:hover": {
              backgroundColor: mode.hover
            }
          }
        },
        MuiListItemIcon: {
          root: {
            minWidth: 36,
            color: mode.textMuted
          }
        },
        MuiListSubheader: {
          root: {
            color: mode.textMuted,
            fontSize: ".67rem",
            fontWeight: 600,
            letterSpacing: ".1em",
            textTransform: "uppercase"
          }
        },
        MuiDialog: {
          paper: {
            borderRadius: radii.lg,
            border: `1px solid ${mode.border}`,
            backgroundColor: mode.surfaceOverlay,
            boxShadow: modeShadows.overlay
          }
        },
        MuiBackdrop: {
          root: {
            backgroundColor: mode.scrim
          }
        },
        MuiDialogTitle: {
          root: {
            padding: "18px 24px 12px",
            "& .MuiTypography-root": {
              fontSize: "1.05rem",
              fontWeight: 600,
              letterSpacing: "-.015em"
            }
          }
        },
        MuiDialogContent: {
          dividers: {
            borderColor: mode.border
          }
        },
        MuiDialogActions: {
          root: {
            padding: "12px 20px 18px",
            gap: 8
          }
        },
        MuiPopover: {
          paper: {
            borderRadius: radii.md,
            border: `1px solid ${mode.border}`,
            backgroundColor: mode.surfaceOverlay,
            boxShadow: modeShadows.raised
          }
        },
        MuiMenu: {
          paper: {
            borderRadius: radii.md,
            border: `1px solid ${mode.border}`,
            backgroundColor: mode.surfaceOverlay,
            boxShadow: modeShadows.raised
          },
          list: {
            padding: 6
          }
        },
        MuiMenuItem: {
          root: {
            borderRadius: radii.xs,
            minHeight: 36,
            fontSize: ".82rem",
            "&:hover": {
              backgroundColor: mode.hover
            }
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
            fontSize: ".75rem",
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
            transition: `background-color ${motion.duration.micro}ms ${motion.easing}`,
            "&:hover": {
              backgroundColor: mode.hover
            }
          }
        },
        MuiTableContainer: {
          root: {
            borderRadius: radii.md
          }
        },
        MuiChip: {
          root: {
            borderRadius: radii.xs,
            fontWeight: 550,
            backgroundColor: mode.surfaceMuted
          },
          outlined: {
            borderColor: mode.border
          },
          colorPrimary: {
            backgroundColor: darkMode ? colors.brandLight : colors.brand
          },
          colorSecondary: {
            backgroundColor: darkMode ? colors.accentLight : colors.accent
          }
        },
        MuiAvatar: {
          root: {
            fontSize: ".8rem",
            fontWeight: 600
          },
          colorDefault: {
            color: mode.avatarText,
            backgroundColor: mode.avatar
          }
        },
        MuiBadge: {
          badge: {
            fontSize: ".65rem",
            fontWeight: 600
          }
        },
        MuiDivider: {
          root: {
            backgroundColor: mode.border
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
            transition: `box-shadow ${motion.duration.micro}ms ${motion.easing}, border-color ${motion.duration.micro}ms ${motion.easing}`,
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: mode.textMuted
            },
            "&.Mui-focused": {
              boxShadow: modeShadows.focus
            }
          },
          notchedOutline: {
            borderColor: mode.borderStrong
          }
        },
        MuiInputLabel: {
          outlined: {
            fontSize: ".9rem"
          }
        },
        MuiFormHelperText: {
          root: {
            fontSize: ".75rem",
            marginLeft: 2
          }
        },
        MuiSelect: {
          select: {
            "&:focus": {
              backgroundColor: "transparent"
            }
          }
        },
        MuiSwitch: {
          track: {
            backgroundColor: mode.borderStrong,
            opacity: 1
          },
          colorPrimary: {
            "&.Mui-checked + .MuiSwitch-track": {
              backgroundColor: darkMode ? colors.brandLight : colors.brand,
              opacity: 1
            }
          }
        },
        MuiCheckbox: {
          root: {
            color: mode.borderStrong
          }
        },
        MuiRadio: {
          root: {
            color: mode.borderStrong
          }
        },
        MuiLinearProgress: {
          root: {
            height: 4,
            borderRadius: radii.pill,
            backgroundColor: mode.surfaceMuted
          },
          bar: {
            borderRadius: radii.pill
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
        MuiTooltip: {
          tooltip: {
            borderRadius: radii.xs,
            fontSize: "0.76rem",
            padding: "6px 10px",
            backgroundColor: mode.tooltip,
            boxShadow: modeShadows.soft
          }
        },
        MuiSkeleton: {
          root: {
            backgroundColor: mode.surfaceMuted
          },
          wave: {
            "&::after": {
              background: `linear-gradient(90deg, transparent, ${mode.hover}, transparent)`
            }
          }
        },
        MuiAlert: {
          root: {
            borderRadius: radii.sm,
            border: "1px solid transparent",
            fontSize: ".82rem"
          },
          standardSuccess: {
            color: status.success.fg,
            backgroundColor: status.success.bg,
            borderColor: status.success.border,
            "& .MuiAlert-icon": {
              color: status.success.fg
            }
          },
          standardWarning: {
            color: status.warning.fg,
            backgroundColor: status.warning.bg,
            borderColor: status.warning.border,
            "& .MuiAlert-icon": {
              color: status.warning.fg
            }
          },
          standardError: {
            color: status.danger.fg,
            backgroundColor: status.danger.bg,
            borderColor: status.danger.border,
            "& .MuiAlert-icon": {
              color: status.danger.fg
            }
          },
          standardInfo: {
            color: status.info.fg,
            backgroundColor: status.info.bg,
            borderColor: status.info.border,
            "& .MuiAlert-icon": {
              color: status.info.fg
            }
          }
        },
        MuiAutocomplete: {
          paper: {
            borderRadius: radii.md,
            border: `1px solid ${mode.border}`,
            backgroundColor: mode.surfaceOverlay,
            boxShadow: modeShadows.raised
          },
          option: {
            borderRadius: radii.xs,
            margin: "2px 6px",
            fontSize: ".82rem"
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
