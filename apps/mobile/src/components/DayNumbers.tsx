import type { Diet, TodayResponse } from "@kimbo/shared";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { WATER_BLUE, WaterSheet } from "./WaterSheet";
import { create } from "zustand";
import { api } from "@/lib/api";
import { useReduceMotion } from "@/lib/motion";
import { colors, fonts, macroColors, radius, shadow, space } from "@/lib/theme";
import { EXERCISE_ICON } from "./ActivityCards";
import { Icon, type IconName } from "./Icon";
import { Ring } from "./Meter";
import { RollingNumber } from "./RollingNumber";
import { T } from "./Text";

/** Left (what's still to eat) or eaten (what's in). Tapping any card flips the whole section. */
const useMode = create<{ mode: "left" | "eaten"; flip: () => void }>((set) => ({
  mode: "left",
  flip: () => set((s) => ({ mode: s.mode === "left" ? "eaten" : "left" })),
}));

/** Protein looks like what this person actually eats. */
export const PROTEIN_ICON: Record<Diet, string> = {
  non_vegetarian: "🍗",
  eggetarian: "🥚",
  vegetarian: "🧀",
  jain: "🧀",
  vegan: "🫘",
};

interface Stat {
  key: string;
  name: string;
  icon: string;
  eaten: number;
  target: number;
  unit: string;
  color: string;
  /** a goal to reach (protein, fibre) rather than a limit to stay under */
  goal?: boolean;
}

/**
 * Today's numbers, Cal AI-style: one number per card, an icon instead of a percentage, three
 * pages that swipe (calories and macros, fibre and focus, health apps). Tap flips left/eaten.
 */
export function DayNumbers({ data, diet }: { data: TodayResponse; diet: Diet | null }) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const t = data.targets;
  const n = data.totals;
  const calories: Stat = {
    key: "calories",
    name: "Calories",
    icon: "",
    eaten: n.calories,
    // Exercise earns calories back, so the budget grows by what was burned.
    target: t ? t.calories + data.exercise.burned : 0,
    unit: "",
    color: colors.ink,
  };
  const macros: Stat[] = [
    { key: "protein", name: "Protein", icon: PROTEIN_ICON[diet ?? "vegetarian"], eaten: n.protein, target: t?.protein ?? 0, unit: "g", color: macroColors.protein, goal: true },
    { key: "carbs", name: "Carbs", icon: "🌾", eaten: n.carbs, target: t?.carbs ?? 0, unit: "g", color: macroColors.carbs },
    { key: "fat", name: "Fat", icon: "🥜", eaten: n.fat, target: t?.fat ?? 0, unit: "g", color: macroColors.fat },
  ];
  const extras: Stat[] = [
    { key: "fibre", name: "Fibre", icon: "🥦", eaten: n.fibre, target: t?.fibre ?? 0, unit: "g", color: macroColors.fibre, goal: true },
    { key: "satFat", name: "Sat fat", icon: "🧈", eaten: n.satFat, target: t?.satFat ?? 0, unit: "g", color: colors.plum },
  ];

  const pages = [
    <View key="today" style={styles.pageBody}>
      <CalorieCard stat={calories} burned={data.exercise.burned} />
      <View style={styles.row}>
        {macros.map((s) => (
          <MiniCard key={s.key} stat={s} />
        ))}
      </View>
    </View>,
    <View key="focus" style={styles.pageBody}>
      <View style={styles.row}>
        {extras.map((s) => (
          <MiniCard key={s.key} stat={s} />
        ))}
        <FocusMini data={data} />
      </View>
      <HealthScoreCard score={data.healthScore} />
    </View>,
    <View key="health" style={styles.pageBody}>
      <HealthSoon burned={data.exercise.burned} workouts={data.exercise.entries} />
      <WaterRow ml={data.water.ml} />
    </View>,
  ];

  return (
    <View style={{ gap: space.sm }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ marginHorizontal: -space.xl }}
      >
        {pages.map((p, i) => (
          <View key={i} style={{ width, paddingHorizontal: space.xl, paddingBottom: 4 }}>
            {p}
          </View>
        ))}
      </ScrollView>
      <View style={styles.pager}>
        {pages.map((_, i) => (
          <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
        ))}
      </View>
    </View>
  );
}

/** One number and one label for a stat, in the current mode, never asking the reader to subtract. */
function readout(s: Stat, mode: "left" | "eaten"): { value: string; label: string; over: boolean } {
  const eaten = Math.round(s.eaten);
  const fmt = (v: number) => `${v.toLocaleString("en-IN")}${s.unit}`;
  if (mode === "eaten" || !s.target) return { value: fmt(eaten), label: `${s.name} eaten`, over: false };
  const left = Math.round(s.target - s.eaten);
  if (left > 0) return { value: fmt(left), label: s.goal ? `${s.name} to go` : `${s.name} left`, over: false };
  if (s.goal) return { value: "Done", label: `${s.name} goal`, over: false };
  return { value: fmt(-left), label: `${s.name} over`, over: true };
}

function useFlip() {
  const flip = useMode((m) => m.flip);
  return () => {
    Haptics.selectionAsync().catch(() => {});
    flip();
  };
}

/** Cross-fades a label when it changes, while the digits roll. */
function FadeLabel({ text, tone }: { text: string; tone?: "plum" }) {
  const still = useReduceMotion();
  const o = useRef(new Animated.Value(1)).current;
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (text === shown) return;
    if (still) return setShown(text);
    Animated.timing(o, { toValue: 0, duration: 90, useNativeDriver: true }).start(() => {
      setShown(text);
      Animated.timing(o, { toValue: 1, duration: 140, useNativeDriver: true }).start();
    });
  }, [text, shown, still, o]);
  return (
    <Animated.View style={{ opacity: o }}>
      <T variant="label" tone={tone} numberOfLines={1}>
        {shown}
      </T>
    </Animated.View>
  );
}

function CalorieCard({ stat, burned }: { stat: Stat; burned: number }) {
  const mode = useMode((m) => m.mode);
  const flip = useFlip();
  const r = readout(stat, mode);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${r.value} ${r.label}`}
      accessibilityHint="Switches between left and eaten"
      onPress={flip}
      style={({ pressed }) => [styles.card, styles.calCard, pressed && styles.pressed]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <RollingNumber text={r.value} style={styles.calBig} lineHeight={56} />
        <View style={styles.labelRow}>
          <FadeLabel text={r.label} tone={r.over ? "plum" : undefined} />
          <Icon name="repeat" size={12} color={colors.inkFaint} />
          {burned > 0 ? (
            <View style={styles.burnChip} accessibilityLabel={`${burned} calories earned from exercise`}>
              <Icon name="activity" size={11} color={colors.leafDeep} />
              <T variant="caption" tone="leaf" style={{ fontFamily: fonts.bold }}>
                +{burned}
              </T>
            </View>
          ) : null}
        </View>
      </View>
      <Ring value={stat.eaten} max={stat.target || 1} size={100} stroke={9} color={colors.leaf}>
        <Icon name="zap" size={28} color={colors.leafDeep} />
      </Ring>
    </Pressable>
  );
}

function MiniCard({ stat }: { stat: Stat }) {
  const mode = useMode((m) => m.mode);
  const flip = useFlip();
  const r = readout(stat, mode);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${r.value} ${r.label}`}
      onPress={flip}
      style={({ pressed }) => [styles.card, styles.mini, pressed && styles.pressed]}
    >
      <RollingNumber text={r.value} style={styles.miniValue} lineHeight={24} />
      <FadeLabel text={r.label} tone={r.over ? "plum" : undefined} />
      <View style={styles.miniRing}>
        <Ring value={stat.eaten} max={stat.target || 1} size={62} stroke={6} color={stat.color} overColor={stat.goal ? stat.color : colors.plum}>
          <T style={styles.miniIcon}>{stat.icon}</T>
        </Ring>
      </View>
    </Pressable>
  );
}

/**
 * The food focus in words: "On track" / "Add one" under its name, so it's clear what it
 * tracks. Tapping it explains the focus on the Report tab.
 */
function FocusMini({ data }: { data: TodayResponse }) {
  const f = data.focus;
  const s = data.focusSummary;
  const status = !f ? "Set one" : !s?.total ? "Not yet" : s.supported * 2 >= s.total ? "On track" : "Add one";
  const name = f ? f.title.replace(/^More /, "").replace(/^./, (c) => c.toUpperCase()) : "Food focus";
  const on = status === "On track";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}: ${status}`}
      accessibilityHint="Explains your food focus"
      onPress={() => router.navigate("/(tabs)/report")}
      style={({ pressed }) => [styles.card, styles.mini, pressed && styles.pressed]}
    >
      <T style={[styles.miniValue, on && { color: colors.leaf }]}>{status}</T>
      <T variant="label" numberOfLines={2}>
        {name}
      </T>
      <View style={styles.miniRing}>
        <Ring value={s?.supported ?? 0} max={Math.max(1, s?.total ?? 0)} size={62} stroke={6} color={colors.leaf}>
          <T style={styles.miniIcon}>🌱</T>
        </Ring>
      </View>
    </Pressable>
  );
}

const SCORE_COLOR = (score: number) => (score >= 8 ? colors.leaf : score >= 5 ? colors.turmeric : colors.plum);

/** Cal AI's health score card: score out of 10, a bar, one line on what would lift it. Opens the breakdown. */
function HealthScoreCard({ score: h }: { score: TodayResponse["healthScore"] }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Health score ${h.score ?? "not evaluated"}. ${h.line}`}
      accessibilityHint="Opens your daily breakdown"
      onPress={() => router.push("/nutrition")}
      style={({ pressed }) => [styles.card, styles.wide, pressed && styles.pressed]}
    >
      <View style={styles.labelRow}>
        <T variant="heading" style={{ flex: 1 }}>
          Health score
        </T>
        <T variant="heading">{h.score === null ? "N/A" : `${h.score}/10`}</T>
      </View>
      <View style={styles.track}>
        {h.score !== null ? (
          <View style={[styles.fill, { width: `${h.score * 10}%`, backgroundColor: SCORE_COLOR(h.score) }]} />
        ) : null}
      </View>
      <T variant="caption" numberOfLines={2}>
        {h.line}
      </T>
    </Pressable>
  );
}

function BurnRow({ icon, label, calories }: { icon: IconName; label: string; calories: number }) {
  return (
    <View style={styles.burnRow}>
      <Icon name={icon} size={16} color={colors.ink} />
      <View style={{ flex: 1 }}>
        <T variant="bodyStrong" numberOfLines={1}>
          {label}
        </T>
        <T variant="caption">{calories} cal</T>
      </View>
    </View>
  );
}

/** A health-app style tile: white rounded square, filled pink-to-red heart. */
function HeartTile() {
  return (
    <View style={styles.healthIcon}>
      <Svg width={34} height={30} viewBox="0 0 24 21">
        <Defs>
          <LinearGradient id="heart" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FF6B8B" />
            <Stop offset="1" stopColor="#F2364F" />
          </LinearGradient>
        </Defs>
        <Path
          d="M12 21s-1.2-.9-2.9-2.3C5.4 15.6 0 11.3 0 6.4 0 2.9 2.7 0 6.1 0 8.4 0 10.6 1.3 12 3.3 13.4 1.3 15.6 0 17.9 0 21.3 0 24 2.9 24 6.4c0 4.9-5.4 9.2-9.1 12.3C13.2 20.1 12 21 12 21z"
          fill="url(#heart)"
        />
      </Svg>
    </View>
  );
}

/** Cal AI's water row: today's total and a Log water button that opens the sheet. */
function WaterRow({ ml }: { ml: number }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.card, styles.water]}>
      <Svg width={26} height={30} viewBox="0 0 24 28">
        <Path d="M3 2h18l-2.2 23a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L3 2z" fill="#EAF3FA" stroke={WATER_BLUE} strokeWidth={1.6} />
        <Path d="M5.2 11h13.6l-1.4 14H6.6z" fill={WATER_BLUE} opacity={0.55} />
      </Svg>
      <View style={{ flex: 1 }}>
        <T variant="label">Water</T>
        <RollingNumber text={`${ml.toLocaleString("en-IN")} ml`} style={styles.miniValue} lineHeight={24} />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
      >
        <T variant="bodyStrong">Log water</T>
      </Pressable>
      <WaterSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

/** Steps and calories burned are on the way; shown as a promise, not a broken button. */
function HealthSoon({ burned, workouts }: { burned: number; workouts: TodayResponse["exercise"]["entries"] }) {
  // One row per kind of workout, like Cal AI: "Weight lifting 397 cal", "Run 204 cal".
  const byLabel = new Map<string, { kind: (typeof workouts)[number]["kind"]; calories: number }>();
  for (const w of workouts) {
    const row = byLabel.get(w.label);
    byLabel.set(w.label, { kind: w.kind, calories: (row?.calories ?? 0) + w.calories });
  }
  const app = Platform.OS === "ios" ? "Apple Health" : "Health Connect";
  return (
    <View style={styles.row}>
      <View style={[styles.card, styles.healthCard]}>
        <HeartTile />
        <T variant="bodyStrong" align="center">
          {app}
        </T>
        <T variant="caption" align="center">
          Your steps and calories burned, right here.
        </T>
        <View style={styles.soonPill}>
          <T variant="label" tone="leaf" style={{ fontFamily: fonts.bold }}>
            Coming soon
          </T>
        </View>
      </View>
      <View style={[styles.card, styles.burnCard]} accessible accessibilityLabel={`${burned} calories burned today`}>
        <T variant="label">Calories burned</T>
        <View style={styles.burnTotal}>
          <RollingNumber text={`${burned}`} style={styles.burnBig} lineHeight={34} />
          <T variant="label"> cal</T>
        </View>
        <BurnRow icon="navigation" label="Steps" calories={0} />
        {[...byLabel.entries()].slice(0, 3).map(([label, r]) => (
          <BurnRow key={label} icon={EXERCISE_ICON[r.kind]} label={label} calories={r.calories} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageBody: { flex: 1, gap: space.md },
  row: { flex: 1, flexDirection: "row", gap: space.sm },
  card: { borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  pressed: { transform: [{ scale: 0.98 }] },
  calCard: { flexDirection: "row", alignItems: "center", padding: space.lg, gap: space.lg },
  // Tabular digits: each rolling slot is one "0" wide, so a "1" mustn't leave a gap.
  calBig: { fontFamily: fonts.bold, fontSize: 46, lineHeight: 56, letterSpacing: -1, color: colors.ink, fontVariant: ["tabular-nums"] },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  mini: { flex: 1, padding: space.md, gap: 2 },
  miniValue: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24, color: colors.ink, fontVariant: ["tabular-nums"] },
  miniRing: { alignItems: "center", marginTop: space.md },
  miniIcon: { fontSize: 20, lineHeight: 26 },
  wide: { padding: space.lg, gap: space.sm },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.sunk, overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.leaf },
  healthCard: { flex: 1, padding: space.lg, gap: space.xs, alignItems: "center", justifyContent: "center" },
  healthIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: space.xs,
  },
  soonPill: {
    marginTop: space.sm,
    backgroundColor: colors.leafSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  water: { flexDirection: "row", alignItems: "center", padding: space.lg, gap: space.md },
  burnCard: { flex: 1, padding: space.lg, gap: space.sm },
  burnTotal: { flexDirection: "row", alignItems: "baseline", marginBottom: space.xs },
  burnBig: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, color: colors.ink, fontVariant: ["tabular-nums"] },
  burnRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  burnChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginLeft: space.xs,
    backgroundColor: colors.leafSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pager: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: colors.inkFaint },
  dotOn: { backgroundColor: colors.ink, borderColor: colors.ink },
});
