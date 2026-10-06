import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MomentToast } from "@/components/Moments";
import { Loading } from "@/components/ui";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

export default function RootLayout() {
  const loaded = useSession((s) => s.loaded);
  const load = useSession((s) => s.load);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        {loaded ? (
          <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <Stack
              screenOptions={{
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.bg },
                headerTintColor: colors.text,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="welcome" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ title: "Your daily goal" }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="log" options={{ title: "Log a meal", presentation: "modal" }} />
              <Stack.Screen name="review" options={{ title: "Check your meal" }} />
              <Stack.Screen name="food-search" options={{ title: "Food list", presentation: "modal" }} />
              <Stack.Screen name="report-review" options={{ title: "Check your report" }} />
            </Stack>
            <MomentToast />
          </View>
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center" }}>
            <Loading />
          </View>
        )}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
