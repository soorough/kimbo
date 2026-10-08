import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, type StyleProp, type TextStyle } from "react-native";
import { useReduceMotion } from "@/lib/motion";
import { T } from "./Text";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * A number that rolls like an odometer: each digit is a column of 0–9 that slides to its value,
 * so only the digits that change move. Anything else (".", "′", "″", spaces) is drawn as is.
 * Slots are keyed from the right, so 99 → 100 adds a column instead of shuffling them all.
 */
export function RollingNumber({
  text,
  style,
  lineHeight,
}: {
  text: string;
  style: StyleProp<TextStyle>;
  /** must match the style's lineHeight: each digit row is exactly this tall */
  lineHeight: number;
}) {
  const chars = [...text];
  return (
    <View style={styles.row} accessible accessibilityLabel={text}>
      {chars.map((c, i) => {
        const key = chars.length - i;
        return /\d/.test(c) ? (
          <Digit key={key} digit={Number(c)} style={style} lineHeight={lineHeight} />
        ) : (
          <T key={key} style={style}>
            {c}
          </T>
        );
      })}
    </View>
  );
}

function Digit({
  digit,
  style,
  lineHeight: initial,
}: {
  digit: number;
  style: StyleProp<TextStyle>;
  lineHeight: number;
}) {
  const still = useReduceMotion();
  // Measured, not assumed: large system font sizes scale the line height too.
  const [lineHeight, setLineHeight] = useState(initial);
  const y = useRef(new Animated.Value(-digit * initial)).current;

  useEffect(() => {
    if (still) {
      y.setValue(-digit * lineHeight);
      return;
    }
    // Short and slightly springy: fast scrolling keeps re-targeting it, so it reads as a blur that settles.
    Animated.timing(y, {
      toValue: -digit * lineHeight,
      duration: 180,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
    }).start();
  }, [digit, lineHeight, still, y]);

  return (
    <View style={{ height: lineHeight, overflow: "hidden" }}>
      {/* Invisible copy sizes the slot to one tabular digit. */}
      <View onLayout={(e) => setLineHeight(e.nativeEvent.layout.height)}>
        <T style={[style, styles.hidden]}>0</T>
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: y }] }]}>
        {DIGITS.map((d) => (
          <T key={d} style={style}>
            {d}
          </T>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end" },
  hidden: { opacity: 0 },
});
