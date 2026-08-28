export const colors = {
  ink: "#0B1F33",
  navy: "#0D2945",
  brand: "#0C7C72",
  brandDark: "#075E57",
  brandHover: "#087F75",
  brandLight: "#36BFAE",
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
  duration: { micro: 160, transition: 220, panel: 280 },
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
  display: { fontSize: "3rem", fontWeight: 800, letterSpacing: "-.04em" },
  headingXL: { fontSize: "2rem", fontWeight: 800, letterSpacing: "-.03em" },
  headingLG: { fontSize: "1.5rem", fontWeight: 750, letterSpacing: "-.025em" },
  headingMD: {
    fontSize: "1.125rem",
    fontWeight: 700,
    letterSpacing: "-.015em"
  },
  body: { fontSize: ".875rem", lineHeight: 1.6 },
  bodySM: { fontSize: ".8125rem", lineHeight: 1.5 },
  caption: { fontSize: ".75rem", lineHeight: 1.5 },
  overline: { fontSize: ".6875rem", fontWeight: 750, letterSpacing: ".08em" },
  label: { fontSize: ".8125rem", fontWeight: 700 }
};

export const shadows = {
  light: {
    soft: "0 1px 2px rgba(13, 41, 69, .04), 0 10px 30px rgba(13, 41, 69, .06)",
    raised: "0 18px 46px rgba(13, 41, 69, .12)",
    focus: "0 0 0 4px rgba(57, 120, 230, .16)"
  },
  dark: {
    soft: "0 1px 2px rgba(0, 0, 0, .2), 0 12px 34px rgba(0, 0, 0, .22)",
    raised: "0 20px 52px rgba(0, 0, 0, .36)",
    focus: "0 0 0 4px rgba(116, 164, 255, .2)"
  }
};

export const getModeTokens = darkMode => ({
  canvas: darkMode ? "#0A171E" : "#F5F6F3",
  surface: darkMode ? "#0D1D2B" : "#FFFFFF",
  surfaceRaised: darkMode ? "#122638" : "#FFFFFF",
  surfaceMuted: darkMode ? "#112333" : "#F0F3F2",
  surfaceTint: darkMode ? "rgba(54, 191, 174, .09)" : "#EAF7F5",
  text: darkMode ? "#F1F6FB" : "#102A43",
  textMuted: darkMode ? "#9DB0C2" : "#526A80",
  focus: darkMode ? colors.blueLight : colors.blue,
  border: darkMode ? "rgba(183, 205, 224, .13)" : "#DDE6EF",
  borderStrong: darkMode ? "rgba(183, 205, 224, .22)" : "#C8D5E2",
  nav: darkMode ? "#071827" : "#0B2742",
  navMuted: darkMode ? "#9DB0C2" : "#B6C7D8",
  navActive: darkMode ? "rgba(54, 191, 174, .15)" : "rgba(116, 164, 255, .13)"
});
