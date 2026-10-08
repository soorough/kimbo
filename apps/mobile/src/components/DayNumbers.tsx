import type { Diet, TodayResponse } from "@kimbo/shared";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { create } from "zustand";
import { useReduceMotion } from "@/lib/motion";
import { colors, fonts, macroColors, radius, shadow, space } from "@/lib/theme";
import { Icon } from "./Icon";
import { Ring } from "./Meter";
import { RollingNumber } from "./RollingNumber";
import { T } from "./Text";

/** Left (what's still to eat) or eaten (what's in). Tapping any card flips the whole section. */
const useMode = create<{ mode: "left" | "eaten"; flip: () => void }>((set) => ({
  mode: "left",
  flip: () => set((s) => ({ mode: s.mode === "left" ? "eaten" : "left" })),
}));

/** Protein looks like what this person actually eats. */
const PROTEIN_ICON: Record<Diet, string> = {
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
    target: t?.calories ?? 0,
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
      <CalorieCard stat={calories} />
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
        <HelpedCard helped={data.focusSummary?.supported ?? 0} />
      </View>
      <FocusCard data={data} />
    </View>,
    <View key="health" style={styles.pageBody}>
      <HealthSoon />
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

function CalorieCard({ stat }: { stat: Stat }) {
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

/** Meals that helped the food focus today: a count, not a ratio. */
function HelpedCard({ helped }: { helped: number }) {
  return (
    <View style={[styles.card, styles.mini]} accessible accessibilityLabel={`${helped} meals helped your focus today`}>
      <T style={styles.miniValue}>{helped}</T>
      <T variant="label" numberOfLines={1}>
        {helped === 1 ? "Meal helped" : "Meals helped"}
      </T>
      <View style={styles.miniRing}>
        <Ring value={helped} max={Math.max(1, helped)} size={62} stroke={6} color={colors.leaf}>
          <T style={styles.miniIcon}>🌱</T>
        </Ring>
      </View>
    </View>
  );
}

/** Kimbo's answer to Cal AI's health score: the one food habit, and how today is going. */
function FocusCard({ data }: { data: TodayResponse }) {
  const f = data.focus;
  const s = data.focusSummary;
  return (
    <View style={[styles.card, styles.wide]}>
      {f ? (
        <>
          <View style={styles.labelRow}>
            <T variant="heading" style={{ flex: 1 }} numberOfLines={1}>
              {f.title}
            </T>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${s && s.total ? (s.supported / s.total) * 100 : 0}%` }]} />
          </View>
          <T variant="caption" numberOfLines={2}>
            {s && s.total
              ? s.supported === s.total
                ? "Every meal today helped your focus."
                : "Each meal that helps fills this up."
              : "Log a meal and see if it helps."}
          </T>
        </>
      ) : (
        <>
          <T variant="heading">Your food focus</T>
          <T variant="caption">Add your blood report and Kimbo picks one food habit for you.</T>
        </>
      )}
      <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.push("/nutrition")} style={{ alignSelf: "flex-start" }}>
        <T variant="label" tone="leaf" style={{ fontFamily: fonts.bold }}>
          Full breakdown ›
        </T>
      </Pressable>
    </View>
  );
}

/** Steps and calories burned are on the way; shown as a promise, not a broken button. */
function HealthSoon() {
  const app = Platform.OS === "ios" ? "Apple Health" : "Health Connect";
  return (
    <View style={styles.row}>
      <View style={[styles.card, styles.healthCard]}>
        <View style={styles.healthIcon}>
          <Icon name="heart" size={26} color={colors.terracotta} />
        </View>
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
      <View style={[styles.card, styles.healthCard, { alignItems: "flex-start", opacity: 0.55 }]}>
        <T variant="label">Calories burned</T>
        <T style={styles.miniValue}>—</T>
        <View style={[styles.labelRow, { marginTop: space.md }]}>
          <T style={{ fontSize: 18 }}>🚶</T>
          <T variant="bodyStrong">Steps</T>
        </View>
        <T variant="caption">—</T>
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
    backgroundColor: colors.paper,
    marginBottom: space.xs,
  },
  soonPill: {
    marginTop: space.sm,
    backgroundColor: colors.leafSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  pager: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: colors.inkFaint },
  dotOn: { backgroundColor: colors.ink, borderColor: colors.ink },
});
