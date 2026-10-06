import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { macroColors, night, radius, space } from "@/lib/theme";
import { Icon } from "./Icon";
import { Kimbo } from "./Kimbo";
import { T } from "./Text";

// Saturated pastels for the wall only, each paired with near-black ink; app screens keep the main palette.
const tint = {
  mint: "#9FD8B8",
  coral: "#F4A285",
  lilac: "#C3B5F2",
  sky: "#9CCBF0",
  rose: "#F2B3C6",
  cream: night.text,
} as const;
const ink = night.bg;
const inkSoft = "rgba(28,25,22,0.62)";
const inkFaint = "rgba(28,25,22,0.14)";

/**
 * Background for the start screen: two columns of colourful cards — rings, charts and a
 * report-to-focus diagram — drifting upward at different speeds for a little parallax.
 * Each column is drawn twice and moved by exactly one copy's height, so the loop has no
 * seam. Purely decorative (hidden from screen readers) and still when reduce-motion is on.
 */
export function FeatureWall() {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <View style={styles.columns}>
        <Drift speed={20} still={reduceMotion !== false}>
          <LeftCards />
        </Drift>
        <Drift speed={28} still={reduceMotion !== false} offset={56}>
          <RightCards />
        </Drift>
      </View>
      {/* fades so cards drift in and out instead of being cut off; the lower half stays clear for the copy */}
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={night.bg} stopOpacity="1" />
            <Stop offset="0.11" stopColor={night.bg} stopOpacity="0.92" />
            <Stop offset="0.2" stopColor={night.bg} stopOpacity="0" />
            <Stop offset="0.38" stopColor={night.bg} stopOpacity="0.1" />
            <Stop offset="0.55" stopColor={night.bg} stopOpacity="1" />
            <Stop offset="1" stopColor={night.bg} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#fade)" />
      </Svg>
    </View>
  );
}

/** One column that loops upward forever at `speed` px/s. */
function Drift({ speed, still, offset = 0, children }: { speed: number; still: boolean; offset?: number; children: ReactNode }) {
  const [height, setHeight] = useState(0);
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!height || still) return;
    y.setValue(0);
    const loop = Animated.loop(
      Animated.timing(y, { toValue: -height, duration: (height / speed) * 1000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [height, still, speed, y]);

  return (
    <View style={[styles.column, { marginTop: -offset }]}>
      <Animated.View style={{ transform: [{ translateY: y }] }}>
        <View onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}>{children}</View>
        {children}
      </Animated.View>
    </View>
  );
}

function LeftCards() {
  return (
    <View style={styles.stack}>
      <Card color={tint.mint} title="Today">
        <MacroRing />
      </Card>
      <Card color={tint.cream} title="Lunch · one photo">
        <Item name="Roti × 2" kcal={238} share={1} />
        <Item name="Dal" kcal={158} share={0.66} />
        <Item name="Bhindi" kcal={150} share={0.63} />
      </Card>
      <Card color={tint.sky} title="Weight" big="−1.5 kg">
        <WeightLine />
      </Card>
      <Card color={tint.lilac} title="Focus">
        <View style={styles.row}>
          <Kimbo mood="proud" size={34} leaves={3} />
          <T variant="label" style={{ color: ink, flex: 1 }}>
            More fibre
          </T>
        </View>
        <FocusBars />
      </Card>
    </View>
  );
}

function RightCards() {
  return (
    <View style={styles.stack}>
      <Card color={tint.coral} title="This week" big="5 of 7">
        <WeekBars />
      </Card>
      <Card color={tint.cream} title="Blood report">
        <ReportFlow />
      </Card>
      <Card color={tint.rose} title="Streak" big="12 days">
        <Heatmap />
      </Card>
      <Card color={tint.mint} title="Goal">
        <GoalRing />
      </Card>
    </View>
  );
}

function Card({ color, title, big, children }: { color: string; title: string; big?: string; children: ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: color }]}>
      <T variant="caption" style={{ color: inkSoft }}>
        {title}
      </T>
      {big ? (
        <T variant="bodyStrong" style={{ color: ink, marginTop: -4 }}>
          {big}
        </T>
      ) : null}
      {children}
    </View>
  );
}

/** Calories as a ring split into protein / carbs / fat, total in the middle. */
function MacroRing() {
  const r = 30;
  const c = 2 * Math.PI * r;
  // share of the ring each macro takes; the rest is what's left today
  const parts = [
    { share: 0.18, color: macroColors.protein },
    { share: 0.34, color: macroColors.carbs },
    { share: 0.16, color: macroColors.fat },
  ];
  let start = 0;
  return (
    <View style={styles.center}>
      <Svg width={84} height={84} viewBox="0 0 84 84">
        <Circle cx={42} cy={42} r={r} stroke={inkFaint} strokeWidth={9} fill="none" />
        {parts.map((p, i) => {
          const seg = (
            <Circle
              key={i}
              cx={42}
              cy={42}
              r={r}
              stroke={p.color}
              strokeWidth={9}
              fill="none"
              strokeDasharray={`${p.share * c - 2} ${c}`}
              strokeDashoffset={-start * c}
              rotation={-90}
              origin="42, 42"
            />
          );
          start += p.share;
          return seg;
        })}
      </Svg>
      <View style={styles.ringLabel}>
        <T variant="label" style={{ color: ink }}>
          1,240
        </T>
        <T variant="caption" style={{ color: inkSoft, fontSize: 10, lineHeight: 12 }}>
          of 1,800
        </T>
      </View>
    </View>
  );
}

function Item({ name, kcal, share }: { name: string; kcal: number; share: number }) {
  return (
    <View style={{ gap: 3 }}>
      <View style={styles.row}>
        <T variant="caption" style={{ color: ink, flex: 1 }}>
          {name}
        </T>
        <T variant="caption" style={{ color: inkSoft }}>
          {kcal}
        </T>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${share * 100}%` }]} />
      </View>
    </View>
  );
}

/** A falling weight line with dots, and the goal as a dashed line underneath. */
function WeightLine() {
  const pts = [72, 71.8, 71.9, 71.4, 71.2, 70.9, 70.8, 70.5];
  const x = (i: number) => 4 + (i * 112) / (pts.length - 1);
  const yv = (v: number) => 6 + ((72.2 - v) / 2.2) * 44;
  const d = pts.map((v, i) => `${i ? "L" : "M"} ${x(i)} ${yv(v)}`).join(" ");
  return (
    <Svg width="100%" height={64} viewBox="0 0 120 64" preserveAspectRatio="none">
      <Line x1={0} x2={120} y1={yv(70)} y2={yv(70)} stroke={inkSoft} strokeWidth={1} strokeDasharray="3 3" />
      <Path d={`${d} L ${x(pts.length - 1)} 64 L ${x(0)} 64 Z`} fill="rgba(28,25,22,0.1)" />
      <Path d={d} stroke={ink} strokeWidth={2} fill="none" strokeLinejoin="round" />
      {pts.map((v, i) => (
        <Circle key={i} cx={x(i)} cy={yv(v)} r={i === pts.length - 1 ? 3.5 : 2} fill={ink} />
      ))}
    </Svg>
  );
}

/** Seven days of calories against the target line: on-target days solid, others faint. */
function WeekBars() {
  const days = [0.92, 1.04, 0.88, 1.18, 0.97, 0.6, 0.95];
  const on = (v: number) => v >= 0.9 && v <= 1.1;
  const H = 60;
  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 126 ${H}`} preserveAspectRatio="none">
        {days.map((v, i) => {
          const h = (v / 1.25) * H;
          return (
            <Rect key={i} x={i * 18 + 2} y={H - h} width={12} height={h} rx={4} fill={on(v) ? ink : inkFaint} />
          );
        })}
        <Line x1={0} x2={126} y1={H - H / 1.25} y2={H - H / 1.25} stroke={ink} strokeWidth={1} strokeDasharray="3 3" />
      </Svg>
      <View style={[styles.row, { justifyContent: "space-between", marginTop: 4 }]}>
        {"MTWTFSS".split("").map((d, i) => (
          <T key={i} variant="caption" style={{ color: inkSoft, fontSize: 10, lineHeight: 12, width: 12, textAlign: "center" }}>
            {d}
          </T>
        ))}
      </View>
    </View>
  );
}

/** Markers flow into one food focus — the core idea as a tiny diagram. */
function ReportFlow() {
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.row}>
        <Node label="LDL 142" high />
        <Node label="HbA1c 5.6" />
      </View>
      <Svg width="100%" height={22} viewBox="0 0 120 22" preserveAspectRatio="none">
        <Path d="M 28 0 C 28 12, 60 8, 60 22" stroke={ink} strokeWidth={1.5} fill="none" />
        <Path d="M 92 0 C 92 12, 60 8, 60 22" stroke={inkSoft} strokeWidth={1.5} strokeDasharray="3 3" fill="none" />
      </Svg>
      <View style={[styles.node, styles.nodeStrong, { alignSelf: "center" }]}>
        <Icon name="arrow-up" size={12} color={tint.sky} />
        <T variant="caption" style={{ color: tint.sky }}>
          More fibre
        </T>
      </View>
    </View>
  );
}

function Node({ label, high }: { label: string; high?: boolean }) {
  return (
    <View style={[styles.node, { flex: 1, borderColor: high ? ink : inkSoft }]}>
      <T variant="caption" style={{ color: ink, fontSize: 10, lineHeight: 13 }} numberOfLines={1}>
        {label}
      </T>
    </View>
  );
}

/** Four weeks of days, a row per week, filled where the day was logged. */
function Heatmap() {
  const weeks = ["1101111", "1110111", "1111111", "1110000"];
  return (
    <View style={{ gap: 4 }}>
      {weeks.map((w, r) => (
        <View key={r} style={styles.row}>
          {w.split("").map((d, i) => (
            <View
              key={i}
              style={[styles.heatCell, { backgroundColor: d === "1" ? (r >= 2 ? ink : inkSoft) : inkFaint }]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/** How many of this week's focus meals helped. */
function FocusBars() {
  return (
    <View style={[styles.row, { alignItems: "flex-end", height: 34 }]}>
      {[0.4, 0.7, 0.5, 1, 0.8].map((v, i) => (
        <View key={i} style={{ flex: 1, height: 34 * v, borderRadius: 4, backgroundColor: i === 3 ? "#2E6B4F" : inkFaint }} />
      ))}
    </View>
  );
}

/** Progress to the goal weight as a thick arc with a badge for halfway. */
function GoalRing() {
  const r = 24;
  const c = 2 * Math.PI * r;
  return (
    <View style={styles.row}>
      <Svg width={60} height={60} viewBox="0 0 60 60">
        <Circle cx={30} cy={30} r={r} stroke={inkFaint} strokeWidth={7} fill="none" />
        <Circle
          cx={30}
          cy={30}
          r={r}
          stroke={ink}
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${0.55 * c} ${c}`}
          rotation={-90}
          origin="30, 30"
        />
      </Svg>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.badge}>
          <Icon name="star" size={11} color={tint.mint} />
        </View>
        <T variant="caption" style={{ color: ink }}>
          Halfway there
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: "row", gap: space.md, paddingHorizontal: space.lg },
  column: { flex: 1 },
  stack: { gap: space.md, paddingBottom: space.md },
  card: { borderRadius: radius.lg, padding: space.md, gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  center: { alignItems: "center", justifyContent: "center" },
  ringLabel: { position: "absolute", alignItems: "center" },
  track: { height: 5, borderRadius: 3, backgroundColor: inkFaint, overflow: "hidden" },
  fill: { height: 5, borderRadius: 3, backgroundColor: ink },
  node: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  nodeStrong: { backgroundColor: ink, borderColor: ink },
  heatCell: { flex: 1, aspectRatio: 1, borderRadius: 3 },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ink,
    alignItems: "center",
    justifyContent: "center",
  },
});
