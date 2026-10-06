import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FeatureWall } from "@/components/FeatureWall";
import { Kimbo } from "@/components/Kimbo";
import { Button, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { fonts, night, space } from "@/lib/theme";

/**
 * First screen. Behind: a slow, endless drift of what Kimbo does (logging, focus,
 * streaks, report, goal). In front: one line and two ways in — set up for real, or
 * open a sample week, the fastest way to see the whole app.
 */
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
    <View style={styles.root}>
      <StatusBar style="light" />
      <FeatureWall />
      <SafeAreaView style={styles.fg}>
        <View style={styles.brand}>
          <Kimbo mood="happy" size={40} leaves={2} />
          <T variant="title" style={[styles.wordmark, { color: night.text }]}>
            kimbo
          </T>
        </View>

        <View style={styles.bottom}>
          <View style={styles.headline}>
            <T variant="display" align="center" style={[styles.h1, { color: night.text }]}>
              Eat like home.
            </T>
            <T variant="display" align="center" style={[styles.h1, { color: night.accent }]}>
              Feel the progress.
            </T>
            <T variant="body" align="center" style={{ marginTop: space.sm, color: night.muted }}>
              Log your thali in one photo. Kimbo turns your blood report into one thing to eat more of.
            </T>
          </View>

          <View style={styles.actions}>
            <Button
              kind="light"
              label="Get started"
              onPress={() => start.mutate("fresh")}
              loading={start.isPending && start.variables === "fresh"}
              disabled={start.isPending}
            />
            <Button
              label="See a sample week"
              kind="outlineLight"
              onPress={() => start.mutate("demo")}
              loading={start.isPending && start.variables === "demo"}
              disabled={start.isPending}
            />
            {start.error ? (
              <T variant="label" align="center" style={{ color: night.accent }}>
                {errorMessage(start.error)}
              </T>
            ) : (
              <T variant="caption" align="center" style={{ color: night.muted }}>
                No sign-up. Setup takes about a minute.
              </T>
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: night.bg },
  fg: { flex: 1, paddingHorizontal: space.xl, justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, marginTop: space.md },
  wordmark: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36 },
  bottom: { gap: space.xxl, paddingBottom: space.lg },
  headline: { gap: 2 },
  h1: { fontSize: 38, lineHeight: 44 },
  actions: { gap: space.md },
});
