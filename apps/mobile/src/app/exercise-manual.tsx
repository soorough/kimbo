import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Icon, Screen, T } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { useLogExercise } from "@/lib/log-exercise";
import { colors, fonts, space } from "@/lib/theme";

/** When you already know the number (a watch, a machine): type it and log. */
export default function ManualExercise() {
  const [calories, setCalories] = useState(0);
  const save = useLogExercise();
  return (
    <Screen
      back
      title="Manual"
      footer={
        <Button
          label="Log"
          disabled={calories < 1}
          loading={save.isPending}
          onPress={() => save.mutate({ kind: "manual", label: "Exercise", intensity: null, minutes: null, calories })}
        />
      }
    >
      <View style={styles.center}>
        <View style={styles.flame}>
          <Icon name="zap" size={26} color={colors.ink} />
        </View>
        <T variant="title">Calories burned</T>
        <View style={styles.row}>
          <TextInput
            value={calories ? String(calories) : ""}
            placeholder="0"
            placeholderTextColor={colors.lineStrong}
            onChangeText={(t) => setCalories(Math.min(5000, Number(t.replace(/\D/g, "")) || 0))}
            keyboardType="number-pad"
            autoFocus
            style={styles.big}
            accessibilityLabel="Calories burned"
          />
          <T style={styles.unit}>cal</T>
        </View>
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
  row: { flexDirection: "row", alignItems: "baseline", gap: space.xs },
  big: { fontFamily: fonts.bold, fontSize: 56, lineHeight: 66, color: colors.ink, padding: 0, minWidth: 50, textAlign: "center" },
  unit: { fontFamily: fonts.bold, fontSize: 22, color: colors.ink },
});
