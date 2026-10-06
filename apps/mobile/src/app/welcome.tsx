import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { Button, Screen } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { font, space } from "@/lib/theme";

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
    <Screen>
      <View style={{ alignItems: "center", gap: space.lg, marginTop: space.xxl * 2 }}>
        <Kimbo mood="wave" size={140} />
        <Text style={[font.title, { textAlign: "center" }]}>Hi, I'm Kimbo</Text>
        <Text style={[font.body, { textAlign: "center", color: "#4A5A51", lineHeight: 22 }]}>
          Log your everyday Indian meals in seconds, see how they connect to your blood report, and watch small
          wins add up.
        </Text>
      </View>
      <View style={{ gap: space.md, marginTop: space.xxl }}>
        <Button label="Start fresh" onPress={() => start.mutate("fresh")} loading={start.isPending && start.variables === "fresh"} />
        <Button
          label="Explore with sample data"
          kind="secondary"
          onPress={() => start.mutate("demo")}
          loading={start.isPending && start.variables === "demo"}
        />
        {start.error ? <Text style={[font.small, { textAlign: "center" }]}>{errorMessage(start.error)}</Text> : null}
        <Text style={[font.small, { textAlign: "center" }]}>No account needed. Your data stays tied to this device.</Text>
      </View>
    </Screen>
  );
}
