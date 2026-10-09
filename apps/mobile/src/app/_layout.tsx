import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold";
import { Fraunces_600SemiBold_Italic } from "@expo-google-fonts/fraunces/600SemiBold_Italic";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Intro } from "@/components/Intro";
import { useIntro } from "@/lib/intro";
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
  // The intro plays once per cold start, over whichever screen the app opens on.
  const introDone = useIntro((s) => s.done);
  const finishIntro = useIntro((s) => s.finish);
  const loadUnits = useUnits((s) => s.load);
  // Only the weights the type scale uses. Per-weight subpath imports matter: the
  // package root requires every weight, so Metro would bundle all 32 files.
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
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
    // The intro hides the native splash on its first frame. Safety nets: font failure, or 4 s.
    if (fontError) SplashScreen.hideAsync().catch(() => {});
    const timer = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 4000);
    return () => clearTimeout(timer);
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
            <Stack.Screen name="report-offer" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="blood-report" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="log" options={sheet} />
            <Stack.Screen name="food-search" options={{ animation: "none" }} />
            <Stack.Screen name="my-foods" options={{ animation: "none" }} />
            <Stack.Screen name="saved-foods" options={{ animation: "none" }} />
            <Stack.Screen name="my-meals" options={{ animation: "none" }} />
            <Stack.Screen name="add-food" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="nutrition" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="edit-goal" options={{ animation: "slide_from_bottom" }} />
            <Stack.Screen name="review" options={{ animation: "slide_from_bottom" }} />
            <Stack.Screen name="report-review" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="assistant" options={{ animation: "slide_from_bottom" }} />
            <Stack.Screen name="milestones" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="meal" options={{ animation: "slide_from_right" }} />
            <Stack.Screen
              name="scan"
              options={{
                presentation: "transparentModal",
                animation: "fade",
                contentStyle: { backgroundColor: "transparent" },
                gestureEnabled: false,
              }}
            />
            <Stack.Screen name="exercise" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="exercise-entry" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="exercise-describe" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="exercise-manual" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="exercise-burned" options={{ animation: "slide_from_right" }} />
          </Stack>
          <MomentToast />
          <Celebration />
          {introDone ? null : <Intro onDone={finishIntro} />}
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
