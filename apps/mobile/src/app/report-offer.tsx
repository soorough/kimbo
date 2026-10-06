import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { Button, Icon, Screen, T, type IconName } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { useReportIntake } from "@/lib/report-intake";
import { colors, radius, space } from "@/lib/theme";

/**
 * Optional last step of first-time setup, shown after the calorie target so the user
 * has already got something back. Skipping is as easy as adding; Today keeps a card
 * for later, so there is no nagging here.
 */
export default function ReportOffer() {
  const intake = useReportIntake();

  if (intake.reading) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <Kimbo mood="thinking" size={120} />
          <T variant="title">Reading your report…</T>
          <T variant="label" align="center">
            You'll check each number next.
          </T>
        </View>
      </Screen>
    );
  }

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

      <View style={styles.options}>
        <Choice
          icon="upload"
          title="Upload PDF or photo"
          subtitle="From your files or lab app"
          primary
          onPress={intake.pickFile}
        />
        <Choice
          icon="camera"
          title="Photograph a printed report"
          subtitle="Lay it flat in good light"
          onPress={intake.snapReport}
        />
        <Choice
          icon="book-open"
          title="Try a sample report"
          subtitle="See it work in 10 seconds"
          onPress={intake.trySample}
        />
      </View>

      {intake.error ? (
        <T variant="label" tone="plum" align="center">
          {errorMessage(intake.error)} You can also add it later from the Report tab.
        </T>
      ) : (
        <T variant="caption" align="center">
          Optional. You can add it any time from the Report tab.
        </T>
      )}
    </Screen>
  );
}

function Choice({
  icon,
  title,
  subtitle,
  primary,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.choiceIcon, primary && { backgroundColor: colors.leaf }]}>
        <Icon name={icon} size={20} color={primary ? colors.white : colors.leafDeep} />
      </View>
      <View style={{ flex: 1 }}>
        <T variant="bodyStrong">{title}</T>
        <T variant="caption">{subtitle}</T>
      </View>
      <Icon name="chevron-right" size={18} color={colors.inkFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md },
  top: { gap: space.md, marginTop: space.xxl },
  options: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden" },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  choiceIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.leafSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
