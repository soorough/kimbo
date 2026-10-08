import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Icon, Ring, Screen, T } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { useExerciseDraft } from "@/lib/exercise-draft";
import { useLogExercise } from "@/lib/log-exercise";
import { useReduceMotion } from "@/lib/motion";
import { colors, fonts, space } from "@/lib/theme";

/** Cal AI's result screen: the ring fills, the number is Kimbo's estimate, the pencil lets you correct it. */
export default function ExerciseBurned() {
  const draft = useExerciseDraft((s) => s.draft);
  const [calories, setCalories] = useState(draft?.calories ?? 0);
  const [editing, setEditing] = useState(false);
  const save = useLogExercise();
  const still = useReduceMotion();
  const fill = useRef(new Animated.Value(still ? 1 : 0)).current;
  const [shown, setShown] = useState(still ? 1 : 0);
  useEffect(() => {
    if (still) return;
    const id = fill.addListener(({ value }) => setShown(value));
    Animated.timing(fill, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => fill.removeListener(id);
  }, [fill, still]);

  if (!draft) {
    router.back();
    return null;
  }
  const detail = [draft.label, draft.minutes ? `${draft.minutes} min` : null, draft.intensity].filter(Boolean).join(" · ");
  return (
    <Screen
      back
      title="Burned calories"
      footer={
        <Button
          label="Log"
          disabled={calories < 1}
          loading={save.isPending}
          onPress={() => save.mutate({ ...draft, calories })}
        />
      }
    >
      <View style={styles.center}>
        <Ring value={shown * 0.7} max={1} size={150} stroke={12} color={colors.ink}>
          <View style={styles.flame}>
            <Icon name="zap" size={26} color={colors.ink} />
          </View>
        </Ring>
        <T variant="title" align="center">
          Your workout burned
        </T>
        {editing ? (
          <View style={styles.editRow}>
            <TextInput
              value={calories ? String(calories) : ""}
              onChangeText={(t) => setCalories(Math.min(5000, Number(t.replace(/\D/g, "")) || 0))}
              keyboardType="number-pad"
              autoFocus
              onBlur={() => setEditing(false)}
              style={styles.big}
              accessibilityLabel="Calories burned"
            />
            <T style={styles.big}>cal</T>
          </View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityHint="Edit calories" onPress={() => setEditing(true)} style={styles.editRow}>
            <T style={styles.big}>{calories} cal</T>
            <Icon name="edit-2" size={18} color={colors.inkFaint} />
          </Pressable>
        )}
        <T variant="caption" align="center">
          {detail}
        </T>
        {save.error ? (
          <T variant="label" tone="plum">
            {errorMessage(save.error)}
          </T>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: space.md, marginTop: space.xxxl * 2 },
  flame: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "#F2EFEA" },
  editRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  big: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 48, color: colors.ink, padding: 0 },
});
