import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Ellipse } from "react-native-svg";
import { Button, Icon, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors, radius, shadow, space } from "@/lib/theme";

/**
 * First screen. One idea — Kimbo's most distinctive trick — shown once, then two ways in:
 * set up for real, or open a sample week (the fastest way for anyone to see the whole app).
 * Report focus and progress are introduced later, where they're actually used.
 */
export default function Welcome() {
  const setProfileId = useSession((s) => s.setProfileId);
  const queryClient = useQueryClient();

  const start = useMutation({
    mutationFn: (mode: "fresh" | "demo") =>
      api.createProfile({ mode, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    onSuccess: async ({ profile }) => {
      queryClient.clear();
      await setProfileId(profile.id);
      router.replace(profile.goal ? "/(tabs)" : "/onboarding");
    },
  });

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.hero}>
        <ThaliVisual />
      </View>

      <View style={styles.copy}>
        <T variant="display">Log your thali in one photo.</T>
        <T variant="body" tone="soft">
          Kimbo spots each dish, counts it by the katori, and checks it against your goal.
        </T>
      </View>

      <View style={styles.actions}>
        <Button
          label="Get started"
          onPress={() => start.mutate("fresh")}
          loading={start.isPending && start.variables === "fresh"}
          disabled={start.isPending}
        />
        <Button
          label="See a sample week"
          kind="secondary"
          onPress={() => start.mutate("demo")}
          loading={start.isPending && start.variables === "demo"}
          disabled={start.isPending}
        />
        {start.error ? (
          <T variant="label" tone="plum" align="center">
            {errorMessage(start.error)}
          </T>
        ) : (
          <T variant="caption" align="center">
            No sign-up. Setup takes about a minute.
          </T>
        )}
      </View>
    </SafeAreaView>
  );
}

/** The labels land one after another, once — enough to show the idea without looping. */
function usePop(count: number, startDelay = 450, gap = 320) {
  const values = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(startDelay),
      Animated.stagger(
        gap,
        values.map((v) => Animated.spring(v, { toValue: 1, useNativeDriver: true, damping: 13, stiffness: 170 })),
      ),
    ]).start();
  }, [values, startDelay, gap]);
  return values.map((v) => ({
    opacity: v,
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
  }));
}

function ThaliVisual() {
  const pop = usePop(4);
  const chips = [
    { label: "Roti × 2", kcal: 238, style: { top: 18, left: 0 } },
    { label: "Dal · 1 katori", kcal: 158, style: { top: 120, right: 0 } },
    { label: "Bhindi · 1 katori", kcal: 150, style: { bottom: 44, left: 0 } },
  ];
  return (
    <View style={styles.visual} accessibilityLabel="A thali with roti, dal and bhindi, each labelled with its calories">
      <Svg width={230} height={230} viewBox="0 0 230 230">
        <Circle cx={115} cy={115} r={110} fill="#E8DFD2" />
        <Circle cx={115} cy={115} r={96} fill="#F4EEE5" />
        {/* katoris */}
        <Circle cx={80} cy={78} r={30} fill="#D9CFC0" />
        <Circle cx={80} cy={78} r={24} fill="#E9B949" />
        <Circle cx={152} cy={86} r={30} fill="#D9CFC0" />
        <Circle cx={152} cy={86} r={24} fill="#6F8F3A" />
        {/* rotis */}
        <Ellipse cx={100} cy={152} rx={42} ry={30} fill="#D7A86E" />
        <Ellipse cx={112} cy={146} rx={40} ry={28} fill="#E2B880" />
        {/* rice */}
        <Circle cx={160} cy={156} r={24} fill="#FFFDF8" />
      </Svg>
      {chips.map((c, i) => (
        <Animated.View key={c.label} style={[styles.chip, c.style, pop[i]]}>
          <Icon name="check" size={14} color={colors.leaf} />
          <T variant="label" fit style={{ color: colors.ink }}>
            {c.label}
          </T>
          <T variant="caption">{c.kcal}</T>
        </Animated.View>
      ))}
      <Animated.View style={[styles.totalPill, pop[3]]}>
        <T variant="label" tone="white">
          546 kcal · you check it before it saves
        </T>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: space.xl },
  hero: { flex: 1, alignItems: "center", justifyContent: "center" },
  visual: { width: 300, height: 300, alignItems: "center", justifyContent: "center" },
  chip: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    ...shadow.card,
  },
  totalPill: {
    position: "absolute",
    bottom: -14,
    backgroundColor: colors.leaf,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  copy: { gap: space.sm, marginBottom: space.xxl },
  actions: { gap: space.md, paddingBottom: space.lg },
});
