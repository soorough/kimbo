export const colors = {
  bg: "#FFF8F0",
  card: "#FFFFFF",
  border: "#EFE3D3",
  text: "#1F2A24",
  muted: "#6B7A71",
  primary: "#2F7D5B",
  primarySoft: "#E3F1EA",
  accent: "#F4A340",
  accentSoft: "#FDEBD3",
  // Over-target and "worth watching" states stay calm — never alarm red.
  calm: "#7C6FB0",
  calmSoft: "#ECE9F7",
  white: "#FFFFFF",
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 14, lg: 22, pill: 999 };
export const font = {
  title: { fontSize: 26, fontWeight: "800" as const, color: colors.text },
  h2: { fontSize: 19, fontWeight: "700" as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  small: { fontSize: 13, color: colors.muted },
};
