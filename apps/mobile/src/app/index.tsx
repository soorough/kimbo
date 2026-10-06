import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { ErrorState } from "@/components/ui";
import { api, ApiRequestError, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors, space } from "@/lib/theme";

/** Routes a launch to welcome, onboarding or Today depending on what this device has set up. */
export default function Index() {
  const loaded = useSession((s) => s.loaded);
  const profileId = useSession((s) => s.profileId);
  const clear = useSession((s) => s.clear);
  const profile = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => api.getProfile(profileId!),
    enabled: !!profileId,
  });

  const missing = profile.error instanceof ApiRequestError && profile.error.status === 404;
  useEffect(() => {
    if (missing) clear();
  }, [missing, clear]);

  if (!loaded) return <Splash />;
  if (!profileId || missing) return <Redirect href="/welcome" />;
  if (profile.data) {
    return profile.data.profile.goal ? <Redirect href="/(tabs)" /> : <Redirect href="/onboarding" />;
  }
  if (profile.error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper, justifyContent: "center", padding: space.lg }}>
        <ErrorState message={errorMessage(profile.error)} onRetry={() => profile.refetch()} />
      </View>
    );
  }
  return <Splash />;
}

function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center" }}>
      <Kimbo mood="idle" size={96} />
    </View>
  );
}
