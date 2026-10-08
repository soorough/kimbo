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

const EXERCISE_ICON: Record<ExerciseEntry["kind"], IconName> = {
  run: "wind",
  weights: "anchor",
  walk: "navigation",
  cycle: "disc",
  yoga: "sun",
  sport: "award",
  other: "activity",
  manual: "zap",
};

/** A water log in Recently logged: the amount, the time, and Cal AI's "…" menu (add water, delete). */
export function WaterEntryCard({ entry }: { entry: WaterEntry }) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <EntryCard
        icon={<Icon name="droplet" size={20} color={WATER_BLUE} />}
        title="Water"
        detail={`${entry.ml.toLocaleString("en-IN")} ml`}
        at={entry.loggedAt}
        menu={[{ label: "Add water", icon: "plus-circle", run: () => setAdding(true) }]}
        remove={() => api.deleteWater(entry.id)}
      />
      <WaterSheet visible={adding} onClose={() => setAdding(false)} />
    </>
  );
}

/** A workout in Recently logged: what, how long, how much it burned. */
export function ExerciseEntryCard({ entry }: { entry: ExerciseEntry }) {
  const detail = [`${entry.calories} cal`, entry.minutes ? `${entry.minutes} min` : null, entry.intensity]
    .filter(Boolean)
    .join(" · ");
  return (
    <EntryCard
      icon={<Icon name={EXERCISE_ICON[entry.kind]} size={20} color={colors.leafDeep} />}
      title={entry.label}
      detail={detail}
      at={entry.loggedAt}
      menu={[]}
      remove={() => api.deleteExercise(entry.id)}
    />
  );
}

function EntryCard({
  icon,
  title,
  detail,
  at,
  menu,
  remove,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
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
    <View style={styles.card}>
      <View style={styles.icon}>{icon}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="heading">{title}</T>
        <T variant="label">{detail}</T>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`More for ${title}`} hitSlop={12} onPress={() => setOpen(true)}>
          <Icon name="more-horizontal" size={20} color={colors.inkSoft} />
        </Pressable>
        <T variant="caption">{time(at)}</T>
      </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  option: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
});
