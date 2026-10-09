import type { Diet, ProgressResponse } from "@kimbo/shared";
import { useLayoutEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { G, Line, Rect, Text as SvgText } from "react-native-svg";
import { colors, radius, space } from "@/lib/theme";
import { useReduceMotion } from "@/lib/motion";
import { CARBS_ICON, FAT_ICON, PROTEIN_ICON } from "./DayNumbers";
import { Icon } from "./Icon";
import { Kimbo } from "./Kimbo";
import { Ring } from "./Meter";
import { Surface } from "./Surface";
import { T } from "./Text";

const DAY_LETTERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CHART_H = 206;
const LEFT = 28;
const TOP = 10;
const BOTTOM = 25;
const MACROS = [
  { key: "protein", label: "Protein", color: "#DE6971", kcalPerGram: 4 },
  { key: "carbs", label: "Carbs", color: "#E8A16C", kcalPerGram: 4 },
  { key: "fat", label: "Fats", color: "#718DC7", kcalPerGram: 9 },
] as const;

type Day = ProgressResponse["days"][number];

/** Seven daily calorie bars with their protein, carb and fat contribution. */
export function CaloriesWeek({
  p,
  diet,
  weekTabs,
}: {
  p: ProgressResponse;
  diet: Diet | null;
  weekTabs: { labels: readonly string[]; selected: number; onSelect: (index: number) => void };
}) {
  const [w, setW] = useState(0);
  const reduceMotion = useReduceMotion();
  const growth = useRef(new Animated.Value(0)).current;
  const logged = p.days.filter((d) => (d.calories ?? 0) > 0);
  const average = logged.length
    ? Math.round(logged.reduce((sum, day) => sum + day.calories!, 0) / logged.length)
    : 0;
  const peak = Math.max(...p.days.map((day) => day.calories ?? 0), 1);
  const base = 10 ** Math.floor(Math.log10(Math.max(peak / 4, 1)));
  const tick = [1, 2, 5, 10].map((n) => n * base).find((n) => n >= peak / 4)!;
  const topValue = Math.max(tick, Math.ceil(peak / tick) * tick);
  const ticks = Math.round(topValue / tick);
  const plotH = CHART_H - TOP - BOTTOM;
  const chartW = Math.max(0, w - LEFT - 4);
  const slot = chartW / 7;
  const barW = Math.min(26, slot * 0.5);
  const y = (calories: number) => TOP + plotH * (1 - calories / topValue);
  const todayIndex = p.daysElapsed - 1;
  const dataKey = p.days.map((day) => `${day.date}:${day.calories}:${day.protein}:${day.carbs}:${day.fat}`).join("|");

  useLayoutEffect(() => {
    if (w <= LEFT) return;
    growth.stopAnimation();
    if (reduceMotion) {
      growth.setValue(1);
      return;
    }
    growth.setValue(0.02);
    Animated.timing(growth, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    return () => growth.stopAnimation();
  }, [dataKey, growth, reduceMotion, w]);

  return (
    <Surface accessibilityLabel={`Daily average calories: ${average}. ${logged.length} days logged this week.`}>
      <T variant="heading">Daily Average Calories</T>
      <View style={styles.dailyValue}>
        <T style={styles.dailyNumber}>{average.toLocaleString("en-IN")}</T>
        <T variant="caption">cals</T>
      </View>
      <View style={{ height: CHART_H, marginTop: space.md }} onLayout={(e: LayoutChangeEvent) => {
        const width = Math.round(e.nativeEvent.layout.width);
        setW((previous) => previous === width ? previous : width);
      }}>
        {w > LEFT ? (
          <Svg width={w} height={CHART_H}>
            {Array.from({ length: ticks + 1 }, (_, i) => i).map((i) => {
              const value = tick * i;
              const lineY = y(value);
              return (
                <G key={`grid-${i}`}>
                  <Line x1={LEFT} x2={w - 4} y1={lineY} y2={lineY} stroke="#D1D1D3" strokeDasharray={i ? "3 4" : undefined} strokeWidth={1} />
                  <SvgText x={LEFT - 6} y={lineY + 3} fontSize={10} fill={colors.inkFaint} textAnchor="end">{Math.round(value)}</SvgText>
                </G>
              );
            })}
            {p.days.map((day, i) => {
              const x = LEFT + slot * i + (slot - barW) / 2;
              return (
                <G key={day.date}>
                  <Line x1={x + barW / 2} x2={x + barW / 2} y1={TOP} y2={TOP + plotH} stroke="#EFEFF1" strokeDasharray="2 3" />
                  <SvgText x={LEFT + slot * (i + 0.5)} y={CHART_H - 3} textAnchor="middle" fontSize={11}
                    fill={i === todayIndex && weekTabs.selected === 0 ? colors.ink : colors.inkFaint}>
                    {DAY_LETTERS[i]}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        ) : null}
        {w > LEFT ? (
          <Animated.View pointerEvents="none" style={{ position: "absolute", top: TOP, left: 0, width: w, height: plotH,
            transformOrigin: "center bottom", transform: [{ scaleY: growth }] }}>
            <Svg width={w} height={plotH}>
              {p.days.map((day, i) => {
                const calories = day.calories ?? 0;
                if (calories <= 0) return null;
                const x = LEFT + slot * i + (slot - barW) / 2;
                const segments = macroSegments(day);
                let bottom = plotH;
                return segments.map((segment, j) => {
                  const h = Math.max(0, (segment.calories / topValue) * plotH);
                  bottom -= h;
                  return <Rect key={`${day.date}-${j}`} x={x} y={bottom} width={barW} height={h}
                    fill={segment.color} rx={j === segments.length - 1 ? 5 : 0} />;
                });
              })}
            </Svg>
          </Animated.View>
        ) : null}
      </View>
      <View style={styles.macroLegend}>
        {MACROS.map((macro) => (
          <View key={macro.key} style={styles.legendItem}>
            <T style={{ fontSize: 12, lineHeight: 16 }}>{macro.key === "protein" ? PROTEIN_ICON[diet ?? "vegetarian"] : macro.key === "carbs" ? CARBS_ICON : FAT_ICON}</T>
            <T variant="caption" tone="ink">{macro.label}</T>
          </View>
        ))}
      </View>
      <View style={styles.weekTabs}>
        {weekTabs.labels.map((label, i) => (
          <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: i === weekTabs.selected }}
            onPress={() => weekTabs.onSelect(i)} style={[styles.weekTab, i === weekTabs.selected && styles.weekTabOn]}>
            <T variant="caption" tone={i === weekTabs.selected ? "ink" : "faint"}>{label}</T>
          </Pressable>
        ))}
      </View>
    </Surface>
  );
}

function macroSegments(day: Day): { calories: number; color: string }[] {
  const total = day.calories ?? 0;
  const raw = MACROS.map((macro) => ({ calories: day[macro.key] * macro.kcalPerGram, color: macro.color }));
  const macroTotal = raw.reduce((sum, item) => sum + item.calories, 0);
  // Food energy and rounded macro grams differ slightly; scale segments to the saved calorie total.
  return macroTotal > 0
    ? raw.reverse().map((item) => ({ ...item, calories: (item.calories / macroTotal) * total }))
    : [{ calories: total, color: "#D9D9DD" }];
}

/** This week's focus as a ring Kimbo sits in; the sprout grows with the score. */
export function FocusRing({ focus }: { focus: NonNullable<ProgressResponse["focus"]> }) {
  const leaves = 1 + Math.round((focus.pct / 100) * 4);
  return (
    <Surface
      tint="leaf"
      accessibilityLabel={`Focus: ${focus.title}. ${focus.supported} of ${focus.total} meals helped.`}
    >
      <View style={styles.cardHead}>
        <Icon name="target" size={16} color={colors.leaf} />
        <T variant="overline" tone="soft">
          FOCUS
        </T>
      </View>
      <View style={{ alignItems: "center", marginVertical: 2 }}>
        <Ring value={focus.supported} max={Math.max(1, focus.total)} size={92} stroke={10} track="rgba(46,107,79,0.16)">
          <Kimbo mood={focus.pct >= 50 ? "proud" : "focus"} size={50} leaves={leaves} />
        </Ring>
      </View>
      <T variant="label" numberOfLines={2}>
        {focus.title}
      </T>
      <T variant="caption">{focus.total ? `${focus.supported} of ${focus.total} meals helped` : "Log a meal to see if it helps"}</T>
    </Surface>
  );
}

const styles = StyleSheet.create({
  dailyValue: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: space.xs },
  dailyNumber: { fontSize: 36, lineHeight: 42, fontWeight: "700", color: colors.ink },
  macroLegend: { flexDirection: "row", justifyContent: "center", gap: space.lg, marginTop: space.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 2 },
  weekTabs: { flexDirection: "row", backgroundColor: "#F0F0F2", borderRadius: radius.pill, padding: 3, marginTop: space.md },
  weekTab: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: radius.pill },
  weekTabOn: { backgroundColor: colors.surface },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 6 },
});
