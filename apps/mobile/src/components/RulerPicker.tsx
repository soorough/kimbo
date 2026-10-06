import * as Haptics from "expo-haptics";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { colors, space } from "@/lib/theme";
import { T } from "./Text";

const SPACING = 12;

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
}) {
  const scroll = useRef<ScrollView>(null);
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
    requestAnimationFrame(() => scroll.current?.scrollTo({ x: indexOf(value) * SPACING, animated: false }));
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = valueAt(Math.round(e.nativeEvent.contentOffset.x / SPACING));
    if (next !== last.current) {
      last.current = next;
      Haptics.selectionAsync().catch(() => {});
      onChange(next);
    }
  };

  /** Android can come to rest between snap points; settle exactly on the nearest tick. */
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(count - 1, Math.round(e.nativeEvent.contentOffset.x / SPACING)));
    if (Math.abs(e.nativeEvent.contentOffset.x - i * SPACING) > 0.5) {
      scroll.current?.scrollTo({ x: i * SPACING, animated: true });
    }
  };

  const nudge = (dir: 1 | -1) => {
    const next = valueAt(indexOf(value) + dir);
    last.current = next;
    onChange(next);
    scroll.current?.scrollTo({ x: indexOf(next) * SPACING, animated: true });
  };

  const ticks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const major = i % majorEvery === 0;
        return (
          <View key={i} style={styles.tickSlot}>
            <View style={[styles.tick, major ? styles.tickMajor : styles.tickMinor]} />
            {major ? (
              <T variant="caption" style={styles.tickLabel}>
                {valueAt(i)}
              </T>
            ) : null}
          </View>
        );
      }),
    [count, majorEvery, valueAt],
  );

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: `${value} ${unit}` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === "increment" ? 1 : -1)}
    >
      <View style={styles.readout}>
        <T variant="display" style={styles.value}>
          {Number.isInteger(value) ? value : value.toFixed(1)}
        </T>
        <T variant="title" tone="soft">
          {unit}
        </T>
      </View>
      <View style={styles.rulerArea} onLayout={onLayout}>
        {width > 0 ? (
          <ScrollView
            ref={scroll}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={SPACING}
            decelerationRate="fast"
            onScroll={onScroll}
            onMomentumScrollEnd={settle}
            onScrollEndDrag={(e) => {
              // With no fling there is no momentum event, so settle here too.
              if (Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.05) settle(e);
            }}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingHorizontal: width / 2 - SPACING / 2 }}
          >
            {ticks}
          </ScrollView>
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
