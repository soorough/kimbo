import type { ExerciseEntry, WaterEntry } from "@kimbo/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { api } from "@/lib/api";
import { colors, radius, space } from "@/lib/theme";
import { Icon, type IconName } from "./Icon";
import { Sheet } from "./Sheet";
import { T } from "./Text";
import { WATER_BLUE, WaterSheet } from "./WaterSheet";

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const EXERCISE_ICON: Record<ExerciseEntry["kind"], IconName> = {
  run: "wind",
  weights: "anchor",
  walk: "navigation",
  cycle: "disc",
  yoga: "sun",
  sport: "award",
  other: "activity",
  manual: "zap",
};

/**
 * One row in Recently logged, shared by meals, water and workouts so the list reads evenly:
 * a tile on the left, the title with its time, the calories line, and one quiet detail line.
 */
export function LoggedRow({
  tile,
  tileColor = colors.paper,
  title,
  at,
  amount,
  detail,
  badge,
  onPress,
  accessibilityLabel,
}: {
  tile: React.ReactNode;
  tileColor?: string;
  title: string;
  at: string;
  amount: string;
  detail?: string | null;
  badge?: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.tile, { backgroundColor: tileColor }]}>{tile}</View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <T variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{title}</T>
          <T variant="caption" tone="soft">{time(at)}</T>
        </View>
        <View style={styles.titleRow}>
          <T variant="label" style={{ color: colors.ink }}>{amount}</T>
          {badge}
        </View>
        {detail ? <T variant="caption" tone="soft" numberOfLines={1}>{detail}</T> : null}
      </View>
    </Pressable>
  );
}

/** A water log in Recently logged: tap for Add water or Delete. */
export function WaterEntryCard({ entry }: { entry: WaterEntry }) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <EntryCard
        icon={<Icon name="droplet" size={20} color={WATER_BLUE} />}
        tileColor="#E6F0FA"
        title="Water"
        amount={`${entry.ml.toLocaleString("en-IN")} ml`}
        at={entry.loggedAt}
        menu={[{ label: "Add water", icon: "plus-circle", run: () => setAdding(true) }]}
        remove={() => api.deleteWater(entry.id)}
      />
      <WaterSheet visible={adding} onClose={() => setAdding(false)} />
    </>
  );
}

/** A workout in Recently logged: calories burned, then intensity and minutes. */
export function ExerciseEntryCard({ entry }: { entry: ExerciseEntry }) {
  const detail = [
    entry.intensity ? `${entry.intensity[0]!.toUpperCase()}${entry.intensity.slice(1)} intensity` : null,
    entry.minutes ? `${entry.minutes} min` : null,
  ].filter(Boolean).join(" · ");
  return (
    <EntryCard
      icon={<Icon name={EXERCISE_ICON[entry.kind]} size={20} color={colors.terracotta} />}
      tileColor="#FBEDE6"
      title={entry.label}
      amount={`${entry.calories} kcal burned`}
      detail={detail}
      at={entry.loggedAt}
      menu={[]}
      remove={() => api.deleteExercise(entry.id)}
    />
  );
}

function EntryCard({
  icon,
  tileColor,
  title,
  amount,
  detail,
  at,
  menu,
  remove,
}: {
  icon: React.ReactNode;
  tileColor: string;
  title: string;
  amount: string;
  detail?: string;
  at: string;
  menu: { label: string; icon: IconName; run: () => void }[];
  remove: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const del = useMutation({
    mutationFn: remove,
    onSuccess: async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setOpen(false);
      await queryClient.invalidateQueries();
    },
  });
  return (
    <>
      <LoggedRow
        tile={icon}
        tileColor={tileColor}
        title={title}
        at={at}
        amount={amount}
        detail={detail}
        onPress={() => setOpen(true)}
        accessibilityLabel={`${title}, ${amount}. Options`}
      />
      <Sheet visible={open} onClose={() => setOpen(false)} title={title}>
        <View style={{ gap: space.xs }}>
          {menu.map((m) => (
            <Pressable
              key={m.label}
              accessibilityRole="button"
              onPress={() => {
                setOpen(false);
                m.run();
              }}
              style={styles.option}
            >
              <Icon name={m.icon} size={20} color={colors.ink} />
              <T variant="bodyStrong">{m.label}</T>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" disabled={del.isPending} onPress={() => del.mutate()} style={styles.option}>
            <Icon name="trash-2" size={20} color={colors.terracotta} />
            <T variant="bodyStrong" tone="terracotta">
              {del.isPending ? "Deleting…" : "Delete"}
            </T>
          </Pressable>
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  tile: { width: 52, height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  option: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
});
