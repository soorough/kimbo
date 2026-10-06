import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Kimbo } from "@/components/Kimbo";
import { Button, Icon, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors, radius, space } from "@/lib/theme";

const PROMISES: { icon: IconName; title: string; body: string }[] = [
  { icon: "camera", title: "Snap or say it", body: "Roti, dal, sabzi — logged from a photo or one sentence." },
  {
    icon: "file-text",
    title: "One focus from your report",
    body: "Your blood report becomes a simple daily food focus.",
  },
  { icon: "sun", title: "Small wins, no guilt", body: "Kimbo celebrates showing up, not perfection." },
];

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
      <View style={styles.hero}>
        <View style={styles.blob} />
        <Kimbo mood="wave" size={150} leaves={3} />
      </View>
      <View style={styles.body}>
        <T variant="display">
          Eat like home.{"\n"}
          <T variant="display" tone="leaf">
            Feel the progress.
          </T>
        </T>
        <View style={{ gap: space.md }}>
          {PROMISES.map((p) => (
            <View key={p.title} style={styles.promise}>
              <View style={styles.promiseIcon}>
                <Icon name={p.icon} size={18} color={colors.leafDeep} />
              </View>
              <View style={{ flex: 1 }}>
                <T variant="bodyStrong">{p.title}</T>
                <T variant="label">{p.body}</T>
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          label="Start fresh"
          onPress={() => start.mutate("fresh")}
          loading={start.isPending && start.variables === "fresh"}
        />
        <Button
          label="Explore with sample data"
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
            No account needed · your data stays tied to this device
          </T>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: space.xl },
  hero: { alignItems: "center", justifyContent: "center", height: 220 },
  blob: {
    position: "absolute",
    width: 210,
    height: 190,
    borderRadius: 100,
    backgroundColor: colors.leafSoft,
    transform: [{ rotate: "-8deg" }],
  },
  body: { flex: 1, gap: space.xl, paddingTop: space.md },
  promise: { flexDirection: "row", alignItems: "center", gap: space.md },
  promiseIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.leafSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { gap: space.md, paddingBottom: space.lg },
});
