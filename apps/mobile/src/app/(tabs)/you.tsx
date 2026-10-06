import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { ErrorState, Icon, Loading, Screen, Surface, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors, space } from "@/lib/theme";

const ACTIVITY_LABEL = {
  sedentary: "Mostly sitting",
  light: "Lightly active",
  moderate: "Moderately active",
  active: "Very active",
  very_active: "Extremely active",
} as const;
const GOAL_LABEL = { lose: "Lose weight", maintain: "Maintain", gain: "Gain weight" } as const;

/** Settings live in one predictable place instead of scattered links. */
export default function You() {
  const profileId = useSession((s) => s.profileId);
  const clear = useSession((s) => s.clear);
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["profile", profileId], queryFn: () => api.getProfile(profileId!) });

  const startOver = async () => {
    queryClient.clear();
    await clear();
    router.replace("/welcome");
  };

  if (profile.isLoading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  if (!profile.data) {
    return (
      <Screen>
        <ErrorState message={errorMessage(profile.error)} onRetry={() => profile.refetch()} />
      </Screen>
    );
  }
  const { goal, isDemo } = profile.data.profile;

  return (
    <Screen>
      <View style={styles.hero}>
        <Kimbo mood="wave" size={72} />
        <View style={{ flex: 1 }}>
          <T variant="title">You</T>
          <T variant="label">{isDemo ? "Exploring with sample data" : "Your data stays tied to this device"}</T>
        </View>
      </View>

      {goal ? (
        <Surface onPress={() => router.push("/onboarding")} accessibilityLabel="Edit daily goal">
          <View style={styles.rowBetween}>
            <T variant="overline">DAILY GOAL</T>
            <T variant="label" tone="leaf">
              Edit
            </T>
          </View>
          <T variant="number">{goal.effectiveTarget} kcal</T>
          <T variant="label">
            {GOAL_LABEL[goal.goal]} · {ACTIVITY_LABEL[goal.activity]} · {goal.weightKg} kg
          </T>
          {goal.targetOverride ? (
            <T variant="caption">Adjusted by you (Kimbo suggested {goal.computedTarget} kcal)</T>
          ) : null}
        </Surface>
      ) : null}

      <View style={styles.list}>
        <Row icon="file-text" label="Health reports" onPress={() => router.push("/(tabs)/report")} />
        <View style={styles.divider} />
        <Row
          icon={isDemo ? "user-plus" : "refresh-ccw"}
          label={isDemo ? "Start fresh with my own data" : "Try the sample data"}
          onPress={startOver}
        />
      </View>

      <Surface tint="sunk">
        <T variant="heading">About Kimbo</T>
        <T variant="label">
          Kimbo estimates nutrition from a curated Indian food list and turns supported blood markers into one food
          focus. It's a habit companion, not a medical service — it doesn't diagnose or give treatment advice. Please
          discuss your results with a doctor.
        </T>
      </Surface>
    </Screen>
  );
}

function Row({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.sunk }]}
    >
      <Icon name={icon} size={20} color={colors.leaf} />
      <T variant="bodyStrong" style={{ flex: 1 }}>
        {label}
      </T>
      <Icon name="chevron-right" size={18} color={colors.inkFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: space.lg, marginTop: space.sm },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  list: { backgroundColor: colors.surface, borderRadius: 22, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginLeft: 52 },
});
