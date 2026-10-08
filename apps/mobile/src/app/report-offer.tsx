import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { ReportOptions } from "@/components/ReportOptions";
import { Button, Screen, T } from "@/components/ui";
import { space } from "@/lib/theme";

/**
 * Standalone report offer (e.g. from Today's "Add your blood report" card). First-time
 * setup shows the same options as an onboarding step, before the plan is built.
 */
export default function ReportOffer() {
  return (
    <Screen footer={<Button label="I'll add it later" kind="ghost" onPress={() => router.replace("/(tabs)")} />}>
      <View style={styles.top}>
        <Kimbo mood="focus" size={88} leaves={2} />
        <T variant="display">Got a recent blood report?</T>
        <T variant="body" tone="soft">
          Kimbo reads your LDL, HbA1c and triglycerides and picks one thing to eat more of. Every meal you log then
          shows if it helped.
        </T>
      </View>
      <ReportOptions />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { gap: space.md, marginTop: space.xxl },
});
