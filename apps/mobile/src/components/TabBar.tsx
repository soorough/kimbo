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
        <T style={{ fontFamily: focused ? fonts.bold : fonts.medium, fontSize: 11, color: tint }}>{label}</T>
      </Pressable>
    );
  });

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      {/* Kimbo floats over Progress and Report. Today has Kimbo's own line at the top; You is settings. */}
      {["progress", "report"].includes(state.routes[state.index]?.name ?? "") ? <AskKimboPill /> : null}
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
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    backgroundColor: colors.paper,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow.raised,
  },
  tab: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 6, borderRadius: radius.pill },
  tabOn: { backgroundColor: colors.leafSoft },
  logButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.raised,
  },
});
