import { StyleSheet, Pressable, View } from "react-native";
import { errorMessage } from "@/lib/api";
import { useReportIntake } from "@/lib/report-intake";
import { colors, radius, space } from "@/lib/theme";
import { Icon, type IconName } from "./Icon";
import { Kimbo } from "./Kimbo";
import { T } from "./Text";

/**
 * The ways in to a blood report (file, camera, sample), plus Kimbo reading it.
 * Shared by the report offer screen and the onboarding step.
 */
export function ReportOptions({ from }: { from?: "onboarding" }) {
  const intake = useReportIntake({ from });

  if (intake.reading) {
    return (
      <View style={styles.center}>
        <Kimbo mood="thinking" size={120} />
        <T variant="title">Reading your report…</T>
        <T variant="label" align="center">
          You'll check each number next.
        </T>
      </View>
    );
  }

  return (
    <View style={{ gap: space.md }}>
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
          {errorMessage(intake.error)} You can also add it later from Progress.
        </T>
      ) : (
        <T variant="caption" align="center">
          Optional. You can add it any time from Progress.
        </T>
      )}
    </View>
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
  center: { alignItems: "center", justifyContent: "center", gap: space.md, paddingVertical: space.xxxl },
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
