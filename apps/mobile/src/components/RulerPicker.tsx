import * as Haptics from "expo-haptics";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { colors, space, type } from "@/lib/theme";
import { RollingNumber } from "./RollingNumber";
import { T } from "./Text";

const SPACING = 12;
/** Closest two haptic ticks may be, so a fast glide reads as a ratchet rather than a buzz. */
const HAPTIC_GAP_MS = 30;

/**
 * Pick a number by scrolling a ruler — no keyboard, no invalid input.
 * Each step gives a light tick so the value can be felt as well as seen.
 */
export function RulerPicker({
  value,
  onChange,
  min,
  max,
  step = 1,
  majorEvery = 10,
  unit,
  label,
  format,
  tickFormat = format,
  compact,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  /** a labelled long tick every N steps */
  majorEvery?: number;
  unit: string;
  label: string;
  /** how to show a value, e.g. 66 → 5′ 6″; defaults to the number itself */
  format?: (v: number) => string;
  /** label for major ticks, if shorter than the readout (5′ 0″ → 5 ft) */
  tickFormat?: (v: number) => string;
  /** smaller readout for long values (dates), so it never wraps and shifts the layout */
  compact?: boolean;
}) {
  const scroll = useRef<FlatList<number>>(null);
  const [width, setWidth] = useState(0);
  const last = useRef(value);
  const count = Math.round((max - min) / step) + 1;
  const indexOf = (v: number) => Math.round((v - min) / step);
  const valueAt = useCallback(
    (i: number) => Math.round((min + Math.max(0, Math.min(count - 1, i)) * step) * 10) / 10,
    [min, step, count],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setWidth(w);
    // Android ignores contentOffset, so position the ruler once it has a size.
    requestAnimationFrame(() => scroll.current?.scrollToOffset({ offset: indexOf(value) * SPACING, animated: false }));
  };

  const isMajor = useCallback(
    (v: number) => {
      const units = v / (step * majorEvery);
      return Math.abs(units - Math.round(units)) < 1e-6;
    },
    [step, majorEvery],
  );

  /**
   * Layered haptics: a soft tick per step, a firmer tap on long ticks (each kg, each 5 years).
   * A fast flick crosses dozens of steps a second, so ticks are spaced at least HAPTIC_GAP_MS apart
   * (a crossed long tick still wins) and the glide feels like a ratchet instead of a buzz.
   */
  const lastBuzz = useRef(0);
  const majorPending = useRef(false);
  const tick = (v: number) => {
    const major = isMajor(v);
    majorPending.current ||= major;
    const now = Date.now();
    if (now - lastBuzz.current < HAPTIC_GAP_MS) return;
    lastBuzz.current = now;
    if (majorPending.current) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    else Haptics.selectionAsync().catch(() => {});
    majorPending.current = false;
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = valueAt(Math.round(e.nativeEvent.contentOffset.x / SPACING));
    if (next !== last.current) {
      last.current = next;
      tick(next);
      onChange(next);
    }
  };

  /** Android can come to rest between snap points; settle exactly on the nearest tick, with a final thunk. */
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(count - 1, Math.round(e.nativeEvent.contentOffset.x / SPACING)));
    if (Math.abs(e.nativeEvent.contentOffset.x - i * SPACING) > 0.5) {
      scroll.current?.scrollToOffset({ offset: i * SPACING, animated: true });
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
  };

  const nudge = (dir: 1 | -1) => {
    const next = valueAt(indexOf(value) + dir);
    last.current = next;
    onChange(next);
    scroll.current?.scrollToOffset({ offset: indexOf(next) * SPACING, animated: true });
  };

  // Rulers can be long (30–200 kg in 0.1s is 1,701 ticks), so only ticks near the screen are drawn.
  const data = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);
  const renderTick = useCallback(
    ({ item: i }: { item: number }) => {
      // Long ticks sit on round values (150, 160…), whatever the ruler's lower limit is.
      const major = isMajor(valueAt(i));
      return (
        <View style={styles.tickSlot}>
          <View style={[styles.tick, major ? styles.tickMajor : styles.tickMinor]} />
          {major ? (
            <T variant="caption" style={styles.tickLabel}>
              {tickFormat ? tickFormat(valueAt(i)) : valueAt(i)}
            </T>
          ) : null}
        </View>
      );
    },
    [isMajor, valueAt, tickFormat],
  );
  const itemLayout = useCallback(
    (_: unknown, i: number) => ({ length: SPACING, offset: SPACING * i, index: i }),
    [],
  );

  // Fractional rulers always show one decimal (71.0, not 71) so digits keep their slots and roll in place.
  const shown = format ? format(value) : step < 1 ? value.toFixed(1) : String(Math.round(value));

  return (
    <View
      style={[styles.wrap, compact && styles.wrapCompact]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: `${format ? format(value) : value} ${unit}` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === "increment" ? 1 : -1)}
    >
      <View style={styles.readout}>
        {compact ? (
          <T variant="display" style={styles.valueCompact} fit>
            {shown}
          </T>
        ) : (
          <RollingNumber text={shown} style={[type.display, styles.value]} lineHeight={styles.value.lineHeight} />
        )}
        <T variant="title" tone="soft" numberOfLines={1} style={compact && styles.unitCompact}>
          {unit}
        </T>
      </View>
      <View style={styles.rulerArea} onLayout={onLayout}>
        {width > 0 ? (
          <FlatList
            ref={scroll}
            data={data}
            renderItem={renderTick}
            keyExtractor={String}
            getItemLayout={itemLayout}
            initialNumToRender={60}
            maxToRenderPerBatch={60}
            windowSize={5}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={SPACING}
            // iOS's standard scroll physics (velocity ×0.998 per ms, a ~0.5 s time constant), measured
            // from Cal AI's scale: a flick glides for 2–3 s and eases in, a slow drag tracks the finger.
            decelerationRate={0.998}
            onScroll={onScroll}
            onMomentumScrollEnd={settle}
            onScrollEndDrag={(e) => {
              // With no fling there is no momentum event, so settle here too.
              if (Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.05) settle(e);
            }}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingHorizontal: width / 2 - SPACING / 2 }}
          />
        ) : null}
        <View pointerEvents="none" style={styles.needle} />
        <View pointerEvents="none" style={[styles.fade, styles.fadeLeft]} />
        <View pointerEvents="none" style={[styles.fade, styles.fadeRight]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xl, alignItems: "stretch", marginTop: space.xxxl * 2 },
  readout: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: space.sm },
  value: { fontSize: 64, lineHeight: 72, fontVariant: ["tabular-nums"] },
  wrapCompact: { marginTop: space.md, gap: space.md },
  valueCompact: { fontSize: 36, lineHeight: 44, flexShrink: 1 },
  unitCompact: { fontSize: 18, lineHeight: 24 },
  rulerArea: { height: 84, justifyContent: "flex-start" },
  tickSlot: { width: SPACING, alignItems: "center" },
  tick: { width: 2, borderRadius: 1, backgroundColor: colors.inkFaint },
  tickMinor: { height: 18, marginTop: 14, opacity: 0.5 },
  tickMajor: { height: 32, backgroundColor: colors.ink },
  tickLabel: { position: "absolute", top: 38, width: 40, textAlign: "center" },
  needle: {
    position: "absolute",
    left: "50%",
    marginLeft: -2,
    top: -4,
    width: 4,
    height: 44,
    borderRadius: 2,
    backgroundColor: colors.leaf,
  },
  fade: { position: "absolute", top: 0, bottom: 0, width: 36, backgroundColor: colors.paper, opacity: 0.6 },
  fadeLeft: { left: 0 },
  fadeRight: { right: 0 },
});
