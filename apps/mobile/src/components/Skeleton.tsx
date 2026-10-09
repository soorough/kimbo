import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, View, type DimensionValue, type ViewStyle } from "react-native";
import { colors, radius, space } from "@/lib/theme";

/** One shared pulse per skeleton screen, so every block breathes in sync. */
const Pulse = createContext<Animated.Value | null>(null);

function SkeletonScreen({ children }: { children: ReactNode }) {
  const v = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.55, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Pulse.Provider value={v}>
      <View style={styles.screen} accessibilityLabel="Loading" accessibilityRole="progressbar">
        {children}
      </View>
    </Pulse.Provider>
  );
}

export function Bone({
  w = "100%",
  h = 14,
  r = radius.sm,
  style,
}: {
  w?: DimensionValue;
  h?: number;
  r?: number;
  style?: ViewStyle;
}) {
  const v = useContext(Pulse);
  return (
    <Animated.View
      style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.sunk, opacity: v ?? 1 }, style]}
    />
  );
}

function Card({ children, h }: { children?: ReactNode; h?: number }) {
  return <View style={[styles.card, h ? { minHeight: h } : null]}>{children}</View>;
}

/** Mirrors Today's layout so content lands where the placeholders were. */
export function TodaySkeleton() {
  return (
    <SkeletonScreen>
      <Bone w={110} h={10} />
      <Bone w="70%" h={30} r={radius.md} />
      <Card h={164}>
        <View style={styles.row}>
          <Bone w={124} h={124} r={62} />
          <View style={{ flex: 1, gap: space.md }}>
            <Bone w="60%" />
            {[0, 1, 2, 3].map((i) => (
              <Bone key={i} h={8} />
            ))}
          </View>
        </View>
      </Card>
      <Card h={120}>
        <Bone w="40%" h={10} />
        <Bone w="75%" h={18} />
        <Bone h={10} />
      </Card>
      {[0, 1, 2].map((i) => (
        <Bone key={i} h={64} r={radius.lg} />
      ))}
    </SkeletonScreen>
  );
}

/** Mirrors Progress top to bottom (tiles, blood report, journey, weight, calories) so nothing jumps. */
export function ProgressSkeleton() {
  return (
    <SkeletonScreen>
      <Bone w="45%" h={34} r={radius.md} />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Bone h={150} r={radius.lg} />
        </View>
        <View style={{ flex: 1 }}>
          <Bone h={150} r={radius.lg} />
        </View>
      </View>
      <Card h={84}>
        <View style={[styles.row, { alignItems: "center" }]}>
          <Bone w={44} h={44} r={22} />
          <View style={{ flex: 1, gap: space.sm }}>
            <Bone w="45%" h={16} />
            <Bone w="65%" h={10} />
          </View>
        </View>
      </Card>
      <Card h={160}>
        <Bone w="40%" h={16} />
        <Bone h={10} />
        <Bone w="80%" h={10} />
      </Card>
      <Card h={240}>
        <Bone w="45%" h={18} />
        <Bone h={150} r={radius.md} />
      </Card>
      <Card h={300}>
        <Bone w="60%" h={18} />
        <View style={[styles.row, { alignItems: "flex-end", flex: 1 }]}>
          {[60, 90, 40, 110, 80, 20, 20].map((h, i) => (
            <Bone key={i} w={22} h={h} r={8} />
          ))}
        </View>
      </Card>
    </SkeletonScreen>
  );
}

/** Generic stack of rows, for lists (food search, reports, settings). */
export function ListSkeleton({ rows = 6, header = true }: { rows?: number; header?: boolean }) {
  return (
    <SkeletonScreen>
      {header ? <Bone w="50%" h={26} r={radius.md} /> : null}
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.listRow}>
          <Bone w={40} h={40} r={20} />
          <View style={{ flex: 1, gap: space.sm }}>
            <Bone w={`${55 + ((i * 13) % 35)}%`} />
            <Bone w="35%" h={10} />
          </View>
        </View>
      ))}
    </SkeletonScreen>
  );
}

export function CardSkeleton({ h = 120 }: { h?: number }) {
  return (
    <SkeletonScreen>
      <Card h={h}>
        <Bone w="40%" h={10} />
        <Bone w="70%" h={18} />
        <Bone h={10} />
      </Card>
    </SkeletonScreen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: space.lg, paddingTop: space.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, justifyContent: "space-between" },
  listRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.xs },
});
