import { router } from "expo-router";
import { View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { Button, Screen, Surface, T } from "@/components/ui";
import { space } from "@/lib/theme";

export default function Groups() {
  return (
    <Screen>
      <View style={{ marginTop: space.sm }}>
        <T variant="display">Groups</T>
      </View>

      <Surface tint="leaf" style={{ alignItems: "center", gap: space.md, paddingVertical: space.xxxl }}>
        <Kimbo mood="wave" size={96} leaves={2} />
        <T variant="overline" align="center">COMING SOON</T>
        <T variant="title" align="center">Good habits grow together</T>
        <T variant="body" tone="soft" align="center">
          A place to share meal ideas and celebrate progress with your people is on its way.
        </T>
      </Surface>

      <Button label="See your progress" kind="secondary" onPress={() => router.navigate("/(tabs)/progress")} />
    </Screen>
  );
}
