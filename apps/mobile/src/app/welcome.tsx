import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Kimbo } from "@/components/Kimbo";
import { Button, Icon, Surface, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors, radius, space } from "@/lib/theme";

/** A real-looking meal card shows what Kimbo does faster than any list of promises. */
const PREVIEW = {
  meal: "Lunch",
  items: "2 roti · 1 katori dal · bhindi",
  kcal: 512,
  helped: "Helped your fibre focus",
};

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
      <View style={styles.body}>
        <Kimbo mood="wave" size={96} leaves={3} />
        <T variant="display">Log your thali in one photo.</T>
        <T variant="body" tone="soft">
          Kimbo counts roti, dal and sabzi by the katori, then checks each meal against your blood report.
        </T>

        <Surface style={styles.preview} accessibilityLabel="Example of a logged lunch">
          <View style={styles.row}>
            <View style={styles.mealIcon}>
              <Icon name="sun" size={18} color={colors.leafDeep} />
            </View>
            <T variant="heading" style={{ flex: 1 }}>
              {PREVIEW.meal}
            </T>
            <T variant="heading">{PREVIEW.kcal}</T>
            <T variant="caption">kcal</T>
          </View>
          <T variant="body">{PREVIEW.items}</T>
          <View style={styles.helped}>
            <Icon name="check" size={14} color={colors.leafDeep} />
            <T variant="caption" tone="leaf">
              {PREVIEW.helped}
            </T>
          </View>
        </Surface>
      </View>

      <View style={styles.actions}>
        <Button
          label="Start"
          onPress={() => start.mutate("fresh")}
          loading={start.isPending && start.variables === "fresh"}
        />
        <Button
          label="Try it with sample data"
          kind="secondary"
          onPress={() => start.mutate("demo")}
          loading={start.isPending && start.variables === "demo"}
        />
        {start.error ? (
          <T variant="label" tone="plum" align="center">
            {errorMessage(start.error)}
          </T>
        ) : (
          <T variant="caption" align="center">
            No sign-up needed.
          </T>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: space.xl },
  body: { flex: 1, justifyContent: "center", gap: space.lg },
  preview: { marginTop: space.md, transform: [{ rotate: "-1.5deg" }] },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  mealIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.leafSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  helped: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.leafSoft,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
  },
  actions: { gap: space.md, paddingBottom: space.lg },
});
