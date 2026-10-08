import { router, type Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
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
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom - space.xs, space.sm) }]}>
      {/* Kimbo sits fixed at the bottom centre of every tab, one tap from the assistant. */}
      <AskKimboPill />
      {/* A floating pill of tabs, with logging as its own round button beside it. */}
      <View style={styles.pill}>{tabs}</View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log a meal"
        onPress={() => router.push("/log")}
        style={({ pressed }) => [styles.logButton, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <Icon name="plus" size={28} color={colors.white} />
      </Pressable>
    </View>
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
