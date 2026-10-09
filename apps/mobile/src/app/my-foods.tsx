import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Notice, Screen, T } from "@/components/ui";
import { colors, space } from "@/lib/theme";

/** Personal foods will appear here once the user saves an individual food. */
export default function MyFoods() {
  return (
    <Screen back title="Log food" scroll={false} padded={false} bottomClearance={false}>
      <View style={styles.tabs}>
        <Pressable accessibilityRole="tab" onPress={() => router.replace("/food-search")} style={styles.tab}>
          <T variant="label" tone="soft">All</T>
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: true }} style={[styles.tab, styles.active]}>
          <T variant="label" style={styles.activeText}>My foods</T>
        </Pressable>
        <Pressable accessibilityRole="tab" onPress={() => router.replace("/my-meals")} style={styles.tab}>
          <T variant="label" tone="soft">My meals</T>
        </Pressable>
        <Pressable accessibilityRole="tab" onPress={() => router.replace("/saved-foods")} style={styles.tab}>
          <T variant="label" tone="soft">Saved foods</T>
        </Pressable>
      </View>
      <View style={styles.empty}>
        <Notice mood="idle" title="No foods saved yet" message="Save an individual food to find it here quickly." />
        <Icon name="bookmark" size={20} color={colors.inkFaint} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: space.xl },
  tab: { minHeight: 48, paddingHorizontal: space.md, alignItems: "center", justifyContent: "center" },
  active: { borderBottomWidth: 2, borderBottomColor: colors.ink },
  activeText: { color: colors.ink },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.md },
});
