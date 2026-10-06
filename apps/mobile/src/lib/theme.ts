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
 */
export const colors = {
  paper: "#FBF6EE",
  surface: "#FFFFFF",
  sunk: "#F3EADC",
  line: "#E9DDCB",

  ink: "#23201B",
  inkSoft: "#5F594F",
  inkFaint: "#9B9387",

  leaf: "#2E6B4F",
  leafDeep: "#1E4C37",
  leafSoft: "#E2EFE6",

  turmeric: "#E39B2D",
  turmericSoft: "#FBEBCD",

  terracotta: "#C2623A",
  terracottaSoft: "#F8E3D8",

  plum: "#6B579C",
  plumSoft: "#EDE8F6",

  white: "#FFFFFF",
  scrim: "rgba(35, 32, 27, 0.45)",
};

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export const fonts = {
  display: "Fraunces_600SemiBold",
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
