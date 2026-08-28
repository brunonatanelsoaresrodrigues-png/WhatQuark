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
export const shadows = {
  light: {
    soft: "0 2px 6px rgba(13, 41, 69, .04)",
    raised: "0 18px 46px rgba(13, 41, 69, .12)",
    focus: "0 0 0 4px rgba(57, 120, 230, .16)"
  },
  dark: {
    soft: "0 2px 6px rgba(0, 0, 0, .1)",
    raised: "0 20px 52px rgba(0, 0, 0, .36)",
    focus: "0 0 0 4px rgba(116, 164, 255, .2)"
  }
};
export const getModeTokens = darkMode => ({
  canvas: darkMode ? "#07121F" : "#F3F6F8",
  surface: darkMode ? "#0C1928" : "#FFFFFF",
  surfaceRaised: darkMode ? "#132335" : "#FFFFFF",
  surfaceMuted: darkMode ? "#101F30" : "#F1F5F8",
  surfaceTint: darkMode ? "#102E36" : "#EAF7F5",
  conversation: darkMode ? "#0A1623" : "#F7F9FA",
  messageIncoming: darkMode ? "#182736" : "#FFFFFF",
  messageOutgoing: darkMode ? "#074B45" : "#DEF1EB",
  avatar: darkMode ? "#183B4D" : "#E0EDF3",
  avatarText: darkMode ? "#BEE3F1" : "#245769",
  text: darkMode ? "#E8EEF5" : "#162B3D",
  textMuted: darkMode ? "#A0B0C1" : "#54697B",
  focus: darkMode ? colors.blueLight : colors.blue,
  border: darkMode ? "#1A2A3B" : "#E0E7EC",
  borderStrong: darkMode ? "#2B4155" : "#C6D3DD",
  nav: darkMode ? "#040F1C" : "#091B2B",
  navMuted: "#A6B8C9",
  navActive: "#0B2B35"
});
