import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { ListSkeleton } from "@/components/Skeleton";
import { Button, ErrorState, Icon, Screen, Sheet, Surface, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { formatPace, formatWeight, useUnits } from "@/lib/units";
import { colors, space } from "@/lib/theme";

const ACTIVITY_LABEL = {
  sedentary: "Mostly sitting",
  light: "Lightly active",
  moderate: "Moderately active",
  active: "Very active",
  very_active: "Extremely active",
} as const;
const GOAL_LABEL = { lose: "Lose weight", maintain: "Maintain", build_muscle: "Build muscle" } as const;

/** Settings live in one predictable place instead of scattered links. */
export default function You() {
  const profileId = useSession((s) => s.profileId);
  const weightUnit = useUnits((u) => u.weight);
  const clear = useSession((s) => s.clear);
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => api.getProfile(profileId!),
    enabled: !!profileId,
  });

  const [confirming, setConfirming] = useState(false);
  const isDemoRef = useRef(false);

  const setProfileId = useSession((s) => s.setProfileId);
  /** Switch straight to the other kind of profile, so the row does what its label says. */
  const startOver = async () => {
    setConfirming(false);
    const mode = isDemoRef.current ? "fresh" : "demo";
    try {
      const { profile: next } = await api.createProfile({
        mode,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      queryClient.clear();
      await setProfileId(next.id);
      router.replace(next.goal ? "/(tabs)" : "/onboarding");
    } catch {
      // Offline or server down: fall back to the welcome screen, which handles errors.
      queryClient.clear();
      await clear();
      router.replace("/welcome");
    }
  };

  if (profile.isLoading)
    return (
      <Screen>
        <ListSkeleton rows={3} />
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
  isDemoRef.current = isDemo;

  return (
    <Screen>
      <View style={styles.hero}>
        <Kimbo mood="wave" size={72} />
        <View style={{ flex: 1 }}>
          <T variant="title">You</T>
          <T variant="label">{isDemo ? "Using sample data" : "No account. Linked to this phone."}</T>
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
            {GOAL_LABEL[goal.goal]}
            {goal.goal !== "maintain" ? ` ${formatPace(goal.weeklyKg, weightUnit)} a week` : ""} ·{" "}
            {ACTIVITY_LABEL[goal.activity]}
          </T>
          <T variant="caption">
            Now {formatWeight(goal.weightKg, weightUnit)}
            {goal.targetWeightKg ? ` · goal ${formatWeight(goal.targetWeightKg, weightUnit)}` : ""}
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
          label={isDemo ? "Use my own data" : "Try sample data"}
          onPress={() => (isDemo ? startOver() : setConfirming(true))}
        />
      </View>

      <Surface tint="sunk">
        <T variant="heading">About Kimbo</T>
        <T variant="label">
          Calories come from Kimbo's list of about 90 Indian dishes. Your food focus comes from LDL, HbA1c and
          triglycerides. Kimbo doesn't diagnose or treat anything. Talk to your doctor about your results.
        </T>
      </Surface>
      {/* With no account, leaving a real profile can't be undone, so it gets a deliberate second step. */}
      <Sheet visible={confirming} onClose={() => setConfirming(false)} title="Leave your data?">
        <View style={{ gap: space.lg }}>
          <T variant="body">
            Your meals and report are linked to this phone only. If you switch to sample data, you can't get back to
            them.
          </T>
          <Button label="Keep my data" onPress={() => setConfirming(false)} />
          <Button label="Switch to sample data" kind="danger" onPress={startOver} />
        </View>
      </Sheet>
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
