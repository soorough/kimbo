import type { Intensity } from "@kimbo/shared";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Icon, Screen, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useExerciseDraft } from "@/lib/exercise-draft";
import { colors, fonts, radius, space } from "@/lib/theme";

const LEVELS: Record<"run" | "weights", Record<Intensity, string>> = {
  run: {
    high: "Sprinting, running hard",
    medium: "Jogging at a steady pace",
    low: "Brisk walk, easy pace",
  },
  weights: {
    high: "Training to failure, breathing heavily",
    medium: "Breaking a sweat, many reps",
    low: "Light weights, little effort",
  },
};
const ORDER: Intensity[] = ["high", "medium", "low"];
/** Knob height on the track, in %, lined up with the three rows. */
const LEVEL_AT: Record<Intensity, number> = { high: 88, medium: 50, low: 12 };
const DURATIONS = [15, 30, 60, 90];

/** Run or weight lifting: pick intensity and duration; Kimbo works out the calories next. */
export default function ExerciseEntry() {
  const { kind: k } = useLocalSearchParams<{ kind?: string }>();
  const kind = k === "weights" ? "weights" : "run";
  const [intensity, setIntensity] = useState<Intensity>("medium");
  const [minutes, setMinutes] = useState(15);
  const setDraft = useExerciseDraft((s) => s.set);
  const estimate = useMutation({
    mutationFn: () => api.estimateExercise({ kind, intensity, minutes }),
    onSuccess: ({ draft }) => {
      setDraft(draft);
      router.push("/exercise-burned");
    },
  });
  const pick = (i: Intensity) => {
    Haptics.selectionAsync().catch(() => {});
    setIntensity(i);
  };

  return (
    <Screen
      back
      title={kind === "run" ? "Run" : "Weight lifting"}
      footer={<Button label="Continue" disabled={!minutes} loading={estimate.isPending} onPress={() => estimate.mutate()} />}
    >
      <View style={styles.section}>
        <Icon name="sun" size={18} color={colors.ink} />
        <T variant="title">Set intensity</T>
      </View>
      <View style={styles.levels}>
        <View style={{ gap: space.md }}>
          {ORDER.map((i) => (
            <Pressable key={i} accessibilityRole="radio" accessibilityState={{ selected: i === intensity }} onPress={() => pick(i)} style={{ gap: 2 }}>
              <T style={[styles.level, i === intensity && styles.levelOn]}>{i[0]!.toUpperCase() + i.slice(1)}</T>
              <T variant={i === intensity ? "bodyStrong" : "caption"}>{LEVELS[kind][i]}</T>
            </Pressable>
          ))}
        </View>
        {/* The slider from Cal AI: a track that fills from the bottom up to the knob at the chosen level. */}
        <View style={styles.track}>
          <View style={[styles.trackFill, { height: `${LEVEL_AT[intensity]}%` }]} />
          <View style={[styles.knob, { bottom: `${LEVEL_AT[intensity]}%` }]} />
        </View>
      </View>

      <View style={styles.section}>
        <Icon name="clock" size={18} color={colors.ink} />
        <T variant="title">Duration</T>
      </View>
      <View style={styles.chips}>
        {DURATIONS.map((d) => (
          <Pressable
            key={d}
            accessibilityRole="radio"
            accessibilityState={{ selected: d === minutes }}
            onPress={() => setMinutes(d)}
            style={[styles.chip, d === minutes && styles.chipOn]}
          >
            <T variant="bodyStrong" style={d === minutes ? { color: colors.white } : undefined}>
              {d} mins
            </T>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={minutes ? String(minutes) : ""}
        onChangeText={(t) => setMinutes(Math.min(600, Number(t.replace(/\D/g, "")) || 0))}
        keyboardType="number-pad"
        placeholder="Minutes"
        placeholderTextColor={colors.inkFaint}
        style={styles.input}
        accessibilityLabel="Minutes"
      />
      {estimate.error ? (
        <T variant="label" tone="plum">
          {errorMessage(estimate.error)}
        </T>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.lg },
  levels: { padding: space.lg, paddingRight: space.xxxl + space.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  level: { fontFamily: fonts.semibold, fontSize: 15, color: colors.inkFaint },
  levelOn: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink },
  // Pinned to the card's right edge, outside the layout flow, so the card hugs the three rows.
  track: {
    position: "absolute",
    right: space.xl,
    top: space.lg,
    bottom: space.lg,
    width: 8,
    borderRadius: 4,
    backgroundColor: colors.sunk,
    justifyContent: "flex-end",
  },
  trackFill: { width: 8, borderRadius: 4, backgroundColor: colors.ink },
  knob: {
    position: "absolute",
    left: -8,
    width: 24,
    height: 24,
    marginBottom: -12,
    borderRadius: 12,
    backgroundColor: colors.ink,
    borderWidth: 4,
    borderColor: colors.sunk,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { borderWidth: 1.5, borderColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.sm },
  chipOn: { backgroundColor: colors.ink },
  input: {
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    padding: space.md,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
  },
});
