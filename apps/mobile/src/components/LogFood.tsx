import { router, useLocalSearchParams, type Href } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, space } from "@/lib/theme";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { T } from "./Text";

/**
 * Params every Log food tab carries. `pick` means review opened the library to add (or swap,
 * with `replaceKey`) one item; without it, a pick starts a fresh log.
 */
export type LogFoodParams = { pick?: string; replaceKey?: string };

export function useLogFoodParams() {
  const params = useLocalSearchParams<LogFoodParams>();
  return { pick: params.pick === "1", replaceKey: params.replaceKey || undefined, params };
}

const TABS: { label: string; path: "/food-search" | "/my-foods" | "/my-meals" | "/saved-foods" }[] = [
  { label: "All", path: "/food-search" },
  { label: "My foods", path: "/my-foods" },
  { label: "My meals", path: "/my-meals" },
  { label: "Saved foods", path: "/saved-foods" },
];

/** Cal AI's Log Food tabs: plain labels, the active one underlined in ink. */
export function LogFoodTabs({ active }: { active: (typeof TABS)[number]["path"] }) {
  const { params } = useLogFoodParams();
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const on = tab.path === active;
        return (
          <Pressable
            key={tab.path}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={on ? undefined : () => router.replace({ pathname: tab.path, params } as Href)}
            style={[styles.tab, on && styles.tabActive]}
          >
            <T variant="label" style={{ color: on ? colors.ink : colors.inkFaint }}>{tab.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One row in the library: name, kcal · portion, and a round + to log it. */
export function FoodCard({
  title,
  calories,
  portion,
  onAdd,
}: {
  title: string;
  calories: number;
  portion: string;
  onAdd: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${title}, ${calories} kcal`}
      onPress={onAdd}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="bodyStrong" numberOfLines={1}>{title}</T>
        <View style={styles.meta}>
          <Icon name="zap" size={14} color={colors.inkSoft} />
          <T variant="caption" tone="soft" numberOfLines={1} style={{ flexShrink: 1 }}>
            {calories} kcal · {portion}
          </T>
        </View>
      </View>
      <View style={styles.plus}>
        <Icon name="plus" size={20} color={colors.ink} />
      </View>
    </Pressable>
  );
}

/** Empty tab: a big food emoji, a title, one line, and the black action pill. */
export function LibraryEmpty({
  emoji,
  title,
  message,
  action,
  onAction,
}: {
  emoji: string;
  title: string;
  message: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <T style={styles.emoji}>{emoji}</T>
      </View>
      <T variant="heading" align="center">{title}</T>
      <T variant="body" tone="soft" align="center">{message}</T>
      <View style={styles.emptyAction}>
        <Button kind="ink" label={action} onPress={onAction} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: space.lg },
  tab: { minHeight: 48, paddingHorizontal: space.sm, marginRight: space.sm, alignItems: "center", justifyContent: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.ink },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.sunk,
    borderWidth: 1,
    borderColor: colors.line,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: space.xs },
  plus: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm, paddingHorizontal: space.xl, paddingBottom: space.xxl },
  emoji: { fontSize: 72, lineHeight: 88 },
  emptyAction: { alignSelf: "stretch", marginTop: space.lg },
});
