import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { api, errorMessage } from "@/lib/api";
import { colors, fonts, radius, space } from "@/lib/theme";
import { Button } from "./Button";
import { Sheet } from "./Sheet";
import { T } from "./Text";

export const WATER_BLUE = "#4A90C2";

const SIZES = [
  { label: "+1 Glass", ml: 250, icon: <Glass /> },
  { label: "+1 Bottle", ml: 500, icon: <Bottle tall={false} /> },
  { label: "+1 Large Bottle", ml: 750, icon: <Bottle tall /> },
];

/**
 * Cal AI's log water sheet: type an amount or tap a size (each tap adds), then Log.
 * Each log is its own entry, so it shows in Recently logged and can be deleted.
 */
export function WaterSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [ml, setMl] = useState(0);
  useEffect(() => {
    if (visible) setMl(0);
  }, [visible]);
  const save = useMutation({
    mutationFn: () => api.addWater(ml),
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
      await queryClient.invalidateQueries();
    },
  });
  const add = (n: number) => {
    Haptics.selectionAsync().catch(() => {});
    setMl((v) => Math.min(5000, v + n));
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Log water">
      <View style={styles.amount}>
        <TextInput
          value={ml ? String(ml) : ""}
          placeholder="0"
          placeholderTextColor={colors.lineStrong}
          onChangeText={(t) => setMl(Math.min(5000, Number(t.replace(/\D/g, "")) || 0))}
          keyboardType="number-pad"
          maxLength={4}
          style={styles.input}
          accessibilityLabel="Millilitres of water"
        />
        <T style={styles.unit}>ml</T>
      </View>
      <View style={styles.sizes}>
        {SIZES.map((s) => (
          <Pressable
            key={s.label}
            accessibilityRole="button"
            accessibilityLabel={`${s.label}, ${s.ml} millilitres`}
            onPress={() => add(s.ml)}
            style={({ pressed }) => [styles.size, pressed && { transform: [{ scale: 0.96 }] }]}
          >
            {s.icon}
            <T variant="bodyStrong" numberOfLines={2}>
              {s.label}
            </T>
            <T variant="caption">{s.ml} ml</T>
          </Pressable>
        ))}
      </View>
      {save.error ? (
        <T variant="label" tone="plum" align="center">
          {errorMessage(save.error)}
        </T>
      ) : null}
      <Button label="Log" disabled={!ml} loading={save.isPending} onPress={() => save.mutate()} />
    </Sheet>
  );
}

function Glass() {
  return (
    <Svg width={24} height={28} viewBox="0 0 24 28">
      <Path d="M3 2h18l-2.2 23a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L3 2z" fill="#EAF3FA" stroke={WATER_BLUE} strokeWidth={1.6} />
      <Path d="M5.2 11h13.6l-1.4 14H6.6z" fill={WATER_BLUE} opacity={0.55} />
    </Svg>
  );
}

function Bottle({ tall }: { tall: boolean }) {
  const h = tall ? 30 : 26;
  return (
    <Svg width={tall ? 22 : 18} height={h} viewBox={`0 0 ${tall ? 22 : 18} ${h}`}>
      <Rect x={tall ? 7 : 6} y={0.8} width={tall ? 8 : 6} height={4} rx={1.2} fill={WATER_BLUE} />
      <Rect
        x={1}
        y={5}
        width={tall ? 20 : 16}
        height={h - 6}
        rx={tall ? 6 : 5}
        fill="#EAF3FA"
        stroke={WATER_BLUE}
        strokeWidth={1.6}
      />
      <Rect x={2.5} y={h * 0.45} width={tall ? 17 : 13} height={h * 0.45} rx={3} fill={WATER_BLUE} opacity={0.55} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  amount: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: space.xs, marginVertical: space.lg },
  input: {
    fontFamily: fonts.bold,
    fontSize: 64,
    lineHeight: 76,
    minWidth: 60,
    textAlign: "center",
    color: colors.ink,
    padding: 0,
    fontVariant: ["tabular-nums"],
  },
  unit: { fontFamily: fonts.bold, fontSize: 22, color: colors.ink },
  sizes: { flexDirection: "row", gap: space.sm, marginBottom: space.xl },
  size: {
    flex: 1,
    gap: 4,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
