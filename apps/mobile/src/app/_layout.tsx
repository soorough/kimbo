import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Celebration, MomentToast } from "@/components/Moments";
import { useSession } from "@/lib/session";
import { useUnits } from "@/lib/units";
import { colors } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

/** Sheets render their own animated panel over a transparent route. */
const sheet = {
  presentation: "transparentModal",
  animation: "none",
  headerShown: false,
  contentStyle: { backgroundColor: "transparent" },
} as const;

export default function RootLayout() {
  const load = useSession((s) => s.load);
  const loadUnits = useUnits((s) => s.load);
  // Only the weights the type scale uses, to keep the bundle small.
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    load();
    loadUnits();
  }, [load, loadUnits]);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  // Keep the native splash up until fonts are ready, so no text is measured with a fallback font.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        {/* The navigator must mount on the first render; the index route waits for the session. */}
        <View style={{ flex: 1, backgroundColor: colors.paper }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="welcome" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="log" options={sheet} />
            <Stack.Screen name="food-search" options={sheet} />
            <Stack.Screen name="review" options={{ animation: "slide_from_bottom" }} />
            <Stack.Screen name="report-review" options={{ animation: "slide_from_right" }} />
          </Stack>
          <MomentToast />
          <Celebration />
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
