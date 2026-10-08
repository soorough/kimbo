import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Screen, T, type IconName } from "@/components/ui";
import { colors, radius, space } from "@/lib/theme";

const KINDS: { title: string; hint: string; icon: IconName; go: () => void }[] = [
  { title: "Run", hint: "Running, jogging, brisk walking", icon: "wind", go: () => router.push({ pathname: "/exercise-entry", params: { kind: "run" } }) },
  { title: "Weight lifting", hint: "Machines, free weights", icon: "anchor", go: () => router.push({ pathname: "/exercise-entry", params: { kind: "weights" } }) },
  { title: "Describe", hint: "Write your workout in words", icon: "edit-3", go: () => router.push("/exercise-describe") },
  { title: "Manual", hint: "Enter exactly how many calories you burned", icon: "hash", go: () => router.push("/exercise-manual") },
];

/** Cal AI's exercise picker: four ways in, each ending at "your workout burned". */
export default function LogExercise() {
  return (
    <Screen back title="Log exercise">
      <View style={{ gap: space.md, marginTop: space.lg }}>
        {KINDS.map((k) => (
          <Pressable
            key={k.title}
            accessibilityRole="button"
            onPress={k.go}
            style={({ pressed }) => [styles.row, pressed && { transform: [{ scale: 0.98 }] }]}
          >
            <View style={styles.icon}>
              <Icon name={k.icon} size={20} color={colors.ink} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="heading">{k.title}</T>
              <T variant="caption">{k.hint}</T>
            </View>
            <Icon name="chevron-right" size={18} color={colors.inkFaint} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
});
