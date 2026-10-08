import * as Haptics from "expo-haptics";
import { router, type Href, type Tabs } from "expo-router";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from "react-native";
import { useReduceMotion } from "@/lib/motion";
import { colors, fonts, radius, shadow, space } from "@/lib/theme";
import { AskKimboPill } from "./AskKimboPill";
import { Icon, type IconName } from "./Icon";
import { T } from "./Text";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const ICONS: Record<string, IconName> = { index: "home", progress: "trending-up", report: "file-text", you: "user" };

/**
 * Four destinations around one raised action. Logging a meal is what people do
 * most, so it sits in the thumb's natural spot instead of competing as a tab.
 */
export function TabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  const [menu, setMenu] = useState(false);
  const bottom = Math.max(insets.bottom - space.xs, space.sm);
  const tabs = state.routes.map((route, index) => {
    const focused = state.index === index;
    const label = descriptors[route.key]?.options.title ?? route.name;
    const tint = focused ? colors.leaf : colors.inkFaint;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        onPress={() => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        style={[styles.tab, focused && styles.tabOn]}
      >
        <Icon name={ICONS[route.name] ?? "circle"} size={22} color={tint} />
        <T style={{ fontFamily: focused ? fonts.bold : fonts.medium, fontSize: 11, lineHeight: 14, color: tint }}>
          {label}
        </T>
      </Pressable>
    );
  });

  return (
    <View style={[styles.bar, { paddingBottom: bottom }]}>
      {/* Kimbo sits fixed at the bottom centre of every tab, one tap from the assistant. */}
      <AskKimboPill />
      {/* A floating pill of tabs, with logging as its own round button beside it. */}
      <View style={styles.pill}>{tabs}</View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log something"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setMenu(true);
        }}
        style={({ pressed }) => [styles.logButton, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <Icon name="plus" size={28} color={colors.white} />
      </Pressable>
      <PlusMenu visible={menu} bottom={bottom} onClose={() => setMenu(false)} />
    </View>
  );
}

const OPTIONS: { label: string; icon: IconName; href: Href }[] = [
  { label: "Log exercise", icon: "activity", href: "/exercise" },
  { label: "My meals", icon: "bookmark", href: "/my-meals" },
  { label: "Search food", icon: "search", href: "/food-search" },
  { label: "Scan food", icon: "camera", href: "/scan" },
];

/**
 * Cal AI's + menu: the screen dims, the + turns into an ✕ in the same spot, and four
 * tiles pop up above it. Tapping outside or the ✕ closes it.
 */
function PlusMenu({ visible, bottom, onClose }: { visible: boolean; bottom: number; onClose: () => void }) {
  const still = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    v.setValue(still ? 1 : 0);
    if (!still) Animated.spring(v, { toValue: 1, damping: 16, stiffness: 220, useNativeDriver: true }).start();
  }, [visible, still, v]);
  const close = (then?: () => void) =>
    Animated.timing(v, { toValue: 0, duration: still ? 0 : 140, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      onClose();
      then?.();
    });
  const go = (href: Href) => close(() => router.push(href));
  // The ✕ sits exactly where the + was: the bar's padding plus half the pill/button height difference.
  const buttonBottom = bottom + 4;
  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={() => close()}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: v }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close menu" onPress={() => close()} />
      </Animated.View>
      <View style={[styles.grid, { bottom: buttonBottom + 56 + space.xl }]} pointerEvents="box-none">
        {OPTIONS.map((o, i) => (
          <Animated.View
            key={o.label}
            style={{
              width: "48%",
              opacity: v,
              transform: [
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [24 + i * 6, 0] }) },
                { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
              ],
            }}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => go(o.href)}
              style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.96 }] }]}
            >
              <Icon name={o.icon} size={24} color={colors.ink} />
              <T variant="bodyStrong">{o.label}</T>
            </Pressable>
          </Animated.View>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close menu"
        onPress={() => close()}
        style={[styles.logButton, styles.closeButton, { bottom: buttonBottom }]}
      >
        <Animated.View
          style={{ transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "135deg"] }) }] }}
        >
          <Icon name="plus" size={28} color={colors.white} />
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Floats over the content (Cal AI-style): no band behind it, just the pill and the + button.
  bar: {
    position: "absolute",
    zIndex: 20,
    elevation: 12,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.xl,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    // Sized to Cal AI's bar: a 64-tall pill and a 56 round + button.
    height: 64,
    padding: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow.raised,
  },
  tab: {
    flex: 1,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: radius.pill,
  },
  tabOn: { backgroundColor: colors.leafSoft },
  scrim: { backgroundColor: "rgba(35, 32, 27, 0.35)" },
  grid: {
    position: "absolute",
    left: space.xl,
    right: space.xl,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: space.md,
  },
  tile: {
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingVertical: space.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.raised,
  },
  closeButton: { position: "absolute", right: space.xl },
  logButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.leaf,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.raised,
  },
});
