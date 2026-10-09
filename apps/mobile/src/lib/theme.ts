import type { TextStyle } from "react-native";

/**
 * Kimbo's design tokens — "a warm Indian kitchen notebook".
 *
 * Why this direction: Kimbo is about home food and gentle habits, so it should feel
 * like a well-kept recipe notebook, not a clinical dashboard or a gym tracker.
 *  - paper/ink neutrals keep long food lists calm and readable
 *  - curry-leaf green carries actions and "this supported your focus"
 *  - turmeric is reserved for celebration (milestones, streaks)
 *  - plum (never red) marks "worth watching" — informative, not alarming
 *  - terracotta appears only for destructive actions the user chose
 * Every text/background pair used is checked against WCAG AA (4.5:1 text, 3:1 graphics).
 */
export const colors = {
  paper: "#FBF6EE",
  surface: "#FFFFFF",
  sunk: "#F3EADC",
  /** decorative dividers only */
  line: "#E9DDCB",
  /** borders that identify a control (inputs, chips) — 3:1 against paper */
  lineStrong: "#9C8B72",

  ink: "#23201B",
  inkSoft: "#5F594F",
  /** smallest readable text — still 5:1 against paper */
  inkFaint: "#716A5E",

  // Action: buttons, links, "this helped your focus".
  leaf: "#2E6B4F",
  leafDeep: "#1E4C37",
  leafSoft: "#E2EFE6",

  // Celebration only: milestones and streaks. Soft for fills, deep for icons/text on it.
  turmeric: "#E39B2D",
  turmericDeep: "#8F5A0B",
  turmericSoft: "#FBEBCD",

  // Caution, never alarm: "worth watching", over target.
  plum: "#6B579C",
  plumSoft: "#EDE8F6",

  // Destructive actions (delete, remove) — the only near-red, and only on demand.
  terracotta: "#A64B27",
  terracottaSoft: "#F8E3D8",

  white: "#FFFFFF",
  scrim: "rgba(35, 32, 27, 0.45)",
};

/**
 * The start screen's night palette: warm charcoal (not black) so the pastel feature cards
 * read clearly. The accent is the wall's mint, not a second orange next to Kimbo's;
 * cream 16.3:1, mint 10.8:1 on the background.
 */
export const night = {
  bg: "#1C1916",
  card: "#2A2621",
  cardLine: "rgba(251,246,238,0.1)",
  inset: "rgba(251,246,238,0.07)",
  text: "#FBF6EE",
  muted: "#B9AFA2",
  accent: "#9FD8B8",
  path: "rgba(251,246,238,0.22)",
} as const;

/** Macro bars: a quiet data palette, each ≥3:1 on the track, kept apart from the role colours above. */
export const macroColors = {
  protein: "#B5532F",
  carbs: "#B7791F",
  // Blue, not plum: plum is the ring's "over target" colour and the two were indistinguishable.
  fat: "#3B6EA5",
  fibre: "#2E6B4F",
} as const;

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export const fonts = {
  display: "Fraunces_600SemiBold",
  displayItalic: "Fraunces_600SemiBold_Italic",
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
} as const;

/**
 * Type scale. Fraunces (a soft serif) for the moments that should feel personal;
 * Plus Jakarta Sans for everything that must be scanned quickly — numbers, lists, labels.
 */
export const type = {
  display: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: colors.ink, letterSpacing: -0.4 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink, letterSpacing: -0.2 },
  heading: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, color: colors.ink },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.inkFaint },
  overline: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, color: colors.leaf },
  number: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 32, color: colors.ink, fontVariant: ["tabular-nums"] },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

export const shadow = {
  card: {
    shadowColor: "#6B4E2A",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: "#3B2A14",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
} as const;
