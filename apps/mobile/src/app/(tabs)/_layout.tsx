import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { colors } from "@/lib/theme";

const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ fontSize: 20, color }}>{glyph}</Text>;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 64, paddingBottom: 8 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today", tabBarIcon: icon("◉") }} />
      <Tabs.Screen name="progress" options={{ title: "Progress", tabBarIcon: icon("▲") }} />
      <Tabs.Screen name="report" options={{ title: "Report", tabBarIcon: icon("✚") }} />
    </Tabs>
  );
}
