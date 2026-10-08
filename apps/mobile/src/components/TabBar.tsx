import { router, type Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, fonts, shadow, space } from "@/lib/theme";
import { AskKimboPill } from "./AskKimboPill";
import { Icon, type IconName } from "./Icon";
import { T } from "./Text";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const ICONS: Record<string, IconName> = { index: "sun", progress: "trending-up", report: "file-text", you: "user" };

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
        style={styles.tab}
      >
        <Icon name={ICONS[route.name] ?? "circle"} size={22} color={tint} />
        <T style={{ fontFamily: focused ? fonts.bold : fonts.medium, fontSize: 11, color: tint }}>{label}</T>
      </Pressable>
    );
  });

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      {/* Kimbo floats over the screens where questions come up; You is settings. */}
      {state.routes[state.index]?.name !== "you" ? <AskKimboPill /> : null}
      {tabs.slice(0, 2)}
      <View style={styles.centerSlot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log a meal"
          onPress={() => router.push("/log")}
          style={({ pressed }) => [styles.logButton, pressed && { transform: [{ scale: 0.94 }] }]}
        >
          <Icon name="plus" size={28} color={colors.white} />
        </Pressable>
      </View>
      {tabs.slice(2)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.surface,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  tab: { flex: 1, alignItems: "center", gap: 3, paddingVertical: space.xs },
  centerSlot: { flex: 1, alignItems: "center" },
  logButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginTop: -30,
    backgroundColor: colors.leaf,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: colors.paper,
    ...shadow.raised,
  },
});
