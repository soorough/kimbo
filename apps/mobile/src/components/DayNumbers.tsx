import type { Diet, TodayResponse } from "@kimbo/shared";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { create } from "zustand";
import { api } from "@/lib/api";
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
      <WaterCard date={data.date} glasses={data.water.glasses} goal={data.water.goal} />
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

/**
 * Water in glasses, not millilitres: droplets fill as the day goes, one number, and − / +.
 * The count updates on screen at once and saves behind it.
 */
function WaterCard({ date, glasses, goal }: { date: string; glasses: number; goal: number }) {
  const queryClient = useQueryClient();
  const [count, setCount] = useState(glasses);
  useEffect(() => setCount(glasses), [glasses, date]);
  const save = useMutation({
    mutationFn: (n: number) => api.setWater(n, date),
    onError: () => setCount(glasses),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["today"] }),
  });
  const change = (d: number) => {
    const n = Math.max(0, Math.min(20, count + d));
    if (n === count) return;
    Haptics.impactAsync(d > 0 ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
    setCount(n);
    save.mutate(n);
  };
  const done = count >= goal;
  return (
    <View style={[styles.card, styles.water]}>
      <View style={{ flex: 1, gap: space.sm }}>
        <View style={styles.labelRow}>
          <RollingNumber text={String(count)} style={styles.miniValue} lineHeight={24} />
          <T variant="label">{done ? (count === 1 ? "glass · goal met" : "glasses · goal met") : count === 1 ? "glass of water" : "glasses of water"}</T>
        </View>
        <View style={styles.drops} accessible accessibilityLabel={`${count} of ${goal} glasses`}>
          {Array.from({ length: goal }, (_, i) => (
            <Droplet key={i} full={i < count} />
          ))}
        </View>
      </View>
      <View style={styles.waterButtons}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="One glass less"
          disabled={count === 0}
          hitSlop={6}
          onPress={() => change(-1)}
          style={({ pressed }) => [styles.round, styles.roundGhost, count === 0 && { opacity: 0.35 }, pressed && styles.pressed]}
        >
          <Icon name="minus" size={18} color={colors.ink} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a glass of water"
          hitSlop={6}
          onPress={() => change(1)}
          style={({ pressed }) => [styles.round, styles.roundOn, pressed && styles.pressed]}
        >
          <Icon name="plus" size={18} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
}

const WATER = "#4A90C2";

/** One glass as a droplet that pops a little when it fills. */
function Droplet({ full }: { full: boolean }) {
  const still = useReduceMotion();
  const s = useRef(new Animated.Value(1)).current;
  const was = useRef(full);
  useEffect(() => {
    if (full && !was.current && !still) {
      s.setValue(0.6);
      Animated.spring(s, { toValue: 1, damping: 8, stiffness: 260, useNativeDriver: true }).start();
    }
    was.current = full;
  }, [full, still, s]);
  return (
    <Animated.View style={{ transform: [{ scale: s }] }}>
      <Svg width={16} height={20} viewBox="0 0 16 20">
        <Path
          d="M8 1C8 1 1.5 8.4 1.5 12.6A6.5 6.5 0 0 0 14.5 12.6C14.5 8.4 8 1 8 1Z"
          fill={full ? WATER : "none"}
          stroke={full ? WATER : colors.lineStrong}
          strokeWidth={1.5}
        />
      </Svg>
    </Animated.View>
  );
}

/** Steps and calories burned are on the way; shown as a promise, not a broken button. */
function HealthSoon() {
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
  drops: { flexDirection: "row", gap: 6 },
  waterButtons: { flexDirection: "row", gap: space.sm },
  round: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  roundGhost: { borderWidth: 1.5, borderColor: colors.lineStrong },
  roundOn: { backgroundColor: WATER },
  pager: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: colors.inkFaint },
  dotOn: { backgroundColor: colors.ink, borderColor: colors.ink },
});
