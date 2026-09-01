export const colors = {
  ink: "#0B1F33",
  navy: "#0D2945",
  brand: "#0C7C72",
  brandDark: "#075E57",
  brandHover: "#087F75",
  brandLight: "#36BFAE",
  // Tom claro usado no hover do botao primario no tema escuro.
  brandLightHover: "#4FD3C2",
  // Texto sobre a cor da marca, por modo.
  onBrandLight: "#FFFFFF",
  onBrandDark: "#062B28",
  // Secundaria: vermelho-tijolo, reservado para acoes destrutivas.
  accent: "#B73744",
  accentLight: "#FFB3B9",
  accentDark: "#932B36",
  onAccentLight: "#FFFFFF",
  onAccentDark: "#3E1017",
  blue: "#3978E6",
  blueLight: "#74A4FF",
  success: "#218A61",
  warning: "#C67A10",
  danger: "#C64B55",
  info: "#347E9B"
};
export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999
};
export const spacing = [0, 4, 8, 12, 16, 24, 32, 40, 48, 64];
export const motion = {
  duration: {
    micro: 160,
    transition: 220,
    panel: 280
  },
  easing: "cubic-bezier(.2,.8,.2,1)"
};
export const layers = {
  header: 1100,
  drawer: 1200,
  modal: 1300,
  toast: 1400,
  tooltip: 1500
};
export const typography = {
  display: {
    fontSize: "3rem",
    fontWeight: 650,
    letterSpacing: "-.04em"
  },
  headingXL: {
    fontSize: "2rem",
    fontWeight: 650,
    letterSpacing: "-.03em"
  },
  headingLG: {
    fontSize: "1.5rem",
    fontWeight: 600,
    letterSpacing: "-.025em"
  },
  headingMD: {
    fontSize: "1.125rem",
    fontWeight: 600,
    letterSpacing: "-.015em"
  },
  body: {
    fontSize: ".875rem",
    lineHeight: 1.6
  },
  bodySM: {
    fontSize: ".8125rem",
    lineHeight: 1.5
  },
  caption: {
    fontSize: ".75rem",
    lineHeight: 1.5
  },
  overline: {
    fontSize: ".6875rem",
    fontWeight: 600,
    letterSpacing: ".08em"
  },
  label: {
    fontSize: ".8125rem",
    fontWeight: 600
  }
};

// Rampa de elevacao. No tema claro a profundidade vem da sombra projetada; no
// escuro a sombra sozinha some contra o fundo, entao cada nivel carrega tambem
// um realce interno de 1px no topo, que e o que separa as camadas.
export const shadows = {
  light: {
    rest: "0 1px 2px rgba(13, 41, 69, .05)",
    soft: "0 2px 6px rgba(13, 41, 69, .06), 0 1px 2px rgba(13, 41, 69, .04)",
    hover: "0 6px 16px rgba(13, 41, 69, .09), 0 2px 4px rgba(13, 41, 69, .05)",
    raised: "0 18px 46px rgba(13, 41, 69, .12), 0 4px 10px rgba(13, 41, 69, .06)",
    overlay: "0 28px 70px rgba(13, 41, 69, .18), 0 6px 16px rgba(13, 41, 69, .08)",
    focus: "0 0 0 4px rgba(57, 120, 230, .16)"
  },
  dark: {
    rest: "inset 0 1px 0 rgba(255, 255, 255, .03), 0 1px 2px rgba(0, 0, 0, .28)",
    soft: "inset 0 1px 0 rgba(255, 255, 255, .04), 0 2px 8px rgba(0, 0, 0, .34)",
    hover: "inset 0 1px 0 rgba(255, 255, 255, .06), 0 8px 20px rgba(0, 0, 0, .42)",
    raised: "inset 0 1px 0 rgba(255, 255, 255, .06), 0 20px 52px rgba(0, 0, 0, .5)",
    overlay: "inset 0 1px 0 rgba(255, 255, 255, .07), 0 30px 76px rgba(0, 0, 0, .6)",
    focus: "0 0 0 4px rgba(116, 164, 255, .2)"
  }
};

export const getModeTokens = darkMode => ({
  canvas: darkMode ? "#07121F" : "#F3F6F8",
  surface: darkMode ? "#0C1928" : "#FFFFFF",
  surfaceRaised: darkMode ? "#152941" : "#FFFFFF",
  surfaceOverlay: darkMode ? "#1B3149" : "#FFFFFF",
  surfaceMuted: darkMode ? "#101F30" : "#F1F5F8",
  surfaceTint: darkMode ? "#102E36" : "#EAF7F5",
  conversation: darkMode ? "#0A1623" : "#F7F9FA",
  messageIncoming: darkMode ? "#182736" : "#FFFFFF",
  messageOutgoing: darkMode ? "#074B45" : "#DEF1EB",
  messageOutgoingBorder: darkMode
    ? "rgba(54, 191, 174, .18)"
    : "rgba(12, 124, 114, .14)",
  avatar: darkMode ? "#183B4D" : "#E0EDF3",
  avatarText: darkMode ? "#BEE3F1" : "#245769",
  text: darkMode ? "#E8EEF5" : "#162B3D",
  textMuted: darkMode ? "#A0B0C1" : "#54697B",
  // Texto na cor da marca, para rotulos e destaques dentro de superficies tint.
  brandText: darkMode ? "#8EE3D6" : "#075E57",
  // Veu solido sobre a conversa (arrastar-e-soltar de arquivos).
  overlayVeil: darkMode ? "rgba(7, 19, 31, .94)" : "rgba(255, 255, 255, .94)",
  // Fundo translucido do header, sob o qual o conteudo rola desfocado.
  headerVeil: darkMode ? "rgba(7, 18, 31, .78)" : "rgba(243, 246, 248, .78)",
  // Tooltip escuro padrao: fica escuro nos dois temas, por contraste.
  tooltip: darkMode ? "#1F344A" : "#20303F",
  selection: "rgba(54, 191, 174, .28)",
  focus: darkMode ? colors.blueLight : colors.blue,
  border: darkMode ? "#1A2A3B" : "#E0E7EC",
  borderStrong: darkMode ? "#2B4155" : "#C6D3DD",
  borderSubtle: darkMode ? "#152435" : "#EDF1F4",
  // Estados de interacao. Sao veus sobrepostos, nao cores solidas: ficam
  // corretos sobre qualquer superficie da rampa.
  hover: darkMode ? "rgba(255, 255, 255, .05)" : "rgba(13, 41, 69, .045)",
  selected: darkMode ? "rgba(54, 191, 174, .14)" : "rgba(12, 124, 114, .1)",
  pressed: darkMode ? "rgba(255, 255, 255, .09)" : "rgba(13, 41, 69, .08)",
  scrim: darkMode ? "rgba(2, 8, 15, .68)" : "rgba(11, 31, 51, .42)",
  // A navegacao e sempre escura, nos dois temas.
  nav: darkMode ? "#040F1C" : "#091B2B",
  navText: "#E8EEF5",
  navMuted: "#A6B8C9",
  navActive: "#0B2B35",
  navActiveHover: "#103744",
  navHover: "rgba(255, 255, 255, .055)",
  navBorder: "rgba(255, 255, 255, .075)",
  navAccent: colors.brandLight
});

// Pares texto/fundo para chips, alertas e indicadores de estado. Substitui as
// tabelas de cor que cada pagina mantinha por conta propria.
export const getStatusTokens = darkMode =>
  darkMode
    ? {
        success: { fg: "#6FD9AE", bg: "#0C2B24", border: "#1B4A3C" },
        warning: { fg: "#EFC078", bg: "#2E2312", border: "#4E3D1C" },
        danger: { fg: "#F5A3AB", bg: "#33161B", border: "#57272E" },
        info: { fg: "#8FCDE3", bg: "#102A34", border: "#20495A" },
        neutral: { fg: "#A0B0C1", bg: "#101F30", border: "#1A2A3B" }
      }
    : {
        success: { fg: "#0F6B49", bg: "#E6F5EE", border: "#BFE3D3" },
        warning: { fg: "#8A5306", bg: "#FDF3E2", border: "#F0D9AE" },
        danger: { fg: "#A32B37", bg: "#FDEDEE", border: "#F3CBD0" },
        info: { fg: "#1F5F79", bg: "#E7F2F7", border: "#C3DDE8" },
        neutral: { fg: "#54697B", bg: "#F1F5F8", border: "#E0E7EC" }
      };

// Converte um token hexadecimal em rgba. Serve para derivar o fundo suave de um
// acento a partir da propria cor, em vez de manter um segundo literal ao lado.
export const withAlpha = (hex, alpha) => {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map(part => part + part).join("") : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Paleta categorica para os graficos, derivada da marca. Comeca no teal e no
// azul da identidade e so depois abre para os demais matizes.
export const getChartPalette = darkMode =>
  darkMode
    ? ["#36BFAE", "#74A4FF", "#EFC078", "#B79BF0", "#6FD9AE", "#F5A3AB", "#8FCDE3", "#E0A473"]
    : ["#0C7C72", "#3978E6", "#C67A10", "#8A5CD6", "#218A61", "#C64B55", "#347E9B", "#B0652A"];

// Gradiente fica restrito a identidade e as acoes principais.
export const getGradients = darkMode => ({
  brand: "linear-gradient(135deg, #0E8A7F 0%, #086E76 100%)",
  brandSoft: darkMode
    ? "linear-gradient(135deg, rgba(54, 191, 174, .16) 0%, rgba(57, 120, 230, .1) 100%)"
    : "linear-gradient(135deg, rgba(12, 124, 114, .1) 0%, rgba(57, 120, 230, .06) 100%)",
  header: darkMode
    ? "linear-gradient(110deg, rgba(11, 39, 66, .72) 0%, rgba(9, 74, 82, .28) 100%)"
    : "linear-gradient(110deg, #FFFFFF 0%, #F2FAFA 100%)",
  nav: darkMode
    ? "linear-gradient(180deg, #061523 0%, #040F1C 100%)"
    : "linear-gradient(180deg, #0C2233 0%, #091B2B 100%)",
  // Brilho da marca atras do cartao de acesso (login/cadastro).
  glow: darkMode
    ? "radial-gradient(closest-side, rgba(54, 191, 174, .16), rgba(54, 191, 174, 0))"
    : "radial-gradient(closest-side, rgba(12, 124, 114, .12), rgba(12, 124, 114, 0))"
});
