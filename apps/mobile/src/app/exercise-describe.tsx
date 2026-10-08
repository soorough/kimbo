import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Icon, Screen, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useExerciseDraft } from "@/lib/exercise-draft";
import { colors, fonts, radius, space } from "@/lib/theme";

/** Write the workout in words; Kimbo reads it and works out the calories from its own table. */
export default function DescribeExercise() {
  const [text, setText] = useState("");
  const setDraft = useExerciseDraft((s) => s.set);
  const estimate = useMutation({
    mutationFn: () => api.estimateExercise({ text }),
    onSuccess: ({ draft }) => {
      setDraft(draft);
      router.push("/exercise-burned");
    },
  });
  return (
    <Screen
      back
      title="Describe exercise"
      footer={<Button label="Add exercise" disabled={text.trim().length < 3} loading={estimate.isPending} onPress={() => estimate.mutate()} />}
    >
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Describe workout time, intensity, etc."
        placeholderTextColor={colors.inkFaint}
        multiline
        autoFocus
        maxLength={300}
        style={styles.input}
        accessibilityLabel="Describe your workout"
      />
      <View style={styles.tag}>
        <Icon name="star" size={14} color={colors.leafDeep} />
        <T variant="label" tone="leaf">
          Kimbo reads it for you
        </T>
      </View>
      <View style={styles.example}>
        <T variant="body">
          <T variant="bodyStrong">Example: </T>
          Played badminton for 45 mins, not too tiring
        </T>
      </View>
      {estimate.error ? (
        <T variant="label" tone="plum">
          {errorMessage(estimate.error)}
        </T>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    padding: space.md,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
    marginTop: space.md,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  example: { padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface },
});
