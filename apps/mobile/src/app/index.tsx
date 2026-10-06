import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { ErrorState, Loading } from "@/components/ui";
import { api, ApiRequestError, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors, space } from "@/lib/theme";

/** Routes a launch to welcome, onboarding or Today depending on what this device has set up. */
export default function Index() {
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

  if (!profileId || missing) return <Redirect href="/welcome" />;
  if (profile.data) {
    return profile.data.profile.goal ? <Redirect href="/(tabs)" /> : <Redirect href="/onboarding" />;
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: space.lg }}>
      {profile.error ? <ErrorState message={errorMessage(profile.error)} onRetry={() => profile.refetch()} /> : <Loading />}
    </View>
  );
}
