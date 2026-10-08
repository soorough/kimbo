import type { ProgressResponse, TodayMeal, TodayResponse } from "@kimbo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { KimboBuddy } from "@/components/KimboBuddy";
import { useMoments } from "@/components/Moments";
import { TodaySkeleton } from "@/components/Skeleton";
import { ErrorState, Icon, Ring, Screen, Surface, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { MEAL_LABEL } from "@/lib/format";
import { useAfterWrite } from "@/lib/mutations";
import { useSession } from "@/lib/session";
import { colors, fonts, macroColors, radius, shadow, space } from "@/lib/theme";

const MEAL_ICON: Record<TodayMeal["mealType"], IconName> = {
  breakfast: "sunrise",
  lunch: "sun",
  snack: "coffee",
  dinner: "moon",
};
const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Today, Cal AI-style: the week at a glance, one number for the day, small macro cards
 * that swipe, and the meals. Kimbo speaks first in one line, which opens Ask Kimbo.
 */
export default function Today() {
  const profileId = useSession((s) => s.profileId);
  const [date, setDate] = useState<string | null>(null);
  const today = useQuery({
    queryKey: ["today", date],
    queryFn: () => (date ? api.todayFor(date) : api.today()),
    // Keep the previous day on screen while the next loads, so the week strip stays where it was swiped.
    placeholderData: (prev) => prev,
  });
  const week = useQuery({ queryKey: ["progress"], queryFn: api.progress });
  const profile = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => api.getProfile(profileId!),
    enabled: !!profileId,
  });
  useWelcomeBack();

  if (today.isLoading && !today.data)
    return (
      <Screen>
        <TodaySkeleton />
      </Screen>
    );
  if (today.error || !today.data) {
    return (
      <Screen>
        <ErrorState message={errorMessage(today.error)} onRetry={() => today.refetch()} />
      </Screen>
    );
  }
  const data = today.data;
  const isToday = date === null;
  const supported = data.focusSummary?.supported ?? 0;

  return (
    <Screen>
      <View style={styles.header}>
        <T variant="display" style={styles.wordmark}>
          kimbo
        </T>
        <View style={{ flex: 1 }} />
        <StreakPill days={week.data?.streak ?? 0} />
        <KimboBuddy mood={data.meals.length ? "happy" : "idle"} leaves={1 + supported} />
      </View>

      {week.data ? (
        <WeekStrip week={week.data} selected={data.date} onPick={(d, isNow) => setDate(isNow ? null : d)} />
      ) : null}

      {profile.data?.profile.isDemo ? <DemoBanner /> : null}

      {isToday ? <KimboLine /> : null}

      <CaloriesCard data={data} />
      <MacroCarousel data={data} />

      <View style={{ gap: space.md }}>
        <T variant="heading">{isToday ? "Today's meals" : "Meals"}</T>
        {data.meals.length ? (
          data.meals.map((m) => <MealCard key={m.id} meal={m} />)
        ) : (
          <EmptyMeals canRepeat={isToday ? data.repeatableMealTypes : []} />
        )}
      </View>
    </Screen>
  );
}

function StreakPill({ days }: { days: number }) {
  return (
    <View style={styles.streak} accessibilityLabel={`${days} day streak`}>
      <Icon name="zap" size={14} color={colors.turmericDeep} />
      <T style={styles.streakText}>{days}</T>
    </View>
  );
}

/** Five weeks, like Cal AI: three before this one, this one, and the next. */
const WEEKS_BACK = 3;
const WEEKS_AHEAD = 1;

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The week strip pages a whole week at a time (Cal AI-style): swipe right for earlier weeks,
 * it snaps to the week, and a light tick marks each one. Today's week is where it starts.
 */
function WeekStrip({
  week,
  selected,
  onPick,
}: {
  week: ProgressResponse;
  selected: string;
  onPick: (date: string, isToday: boolean) => void;
}) {
  const { width } = useWindowDimensions();
  const pageW = width;
  const todayIso = [...week.days].reverse().find((d) => d.calories !== null)?.date ?? selected;
  const starts = Array.from({ length: WEEKS_BACK + 1 + WEEKS_AHEAD }, (_, i) =>
    addDaysIso(week.weekStart, (i - WEEKS_BACK) * 7),
  );
  const [page, setPage] = useState(WEEKS_BACK);
  const scroll = useRef<ScrollView>(null);
  return (
    <ScrollView
      ref={scroll}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -space.xl }}
      contentOffset={{ x: WEEKS_BACK * pageW, y: 0 }}
      onLayout={() => scroll.current?.scrollTo({ x: page * pageW, animated: false })}
      onMomentumScrollEnd={(e) => {
        const p = Math.round(e.nativeEvent.contentOffset.x / pageW);
        if (p !== page) {
          setPage(p);
          Haptics.selectionAsync().catch(() => {});
        }
      }}
    >
      {starts.map((start, i) => (
        <View key={start} style={{ width: pageW, paddingHorizontal: space.xl }}>
          {i === WEEKS_BACK ? (
            <WeekRow week={week} selected={selected} todayIso={todayIso} onPick={onPick} />
          ) : (
            // Other weeks load as they come into view.
            <PastWeek
              start={start}
              near={Math.abs(i - page) <= 1}
              selected={selected}
              todayIso={todayIso}
              onPick={onPick}
            />
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function PastWeek({
  start,
  near,
  selected,
  todayIso,
  onPick,
}: {
  start: string;
  near: boolean;
  selected: string;
  todayIso: string;
  onPick: (date: string, isToday: boolean) => void;
}) {
  const q = useQuery({ queryKey: ["progress", start], queryFn: () => api.progressFor(start), enabled: near });
  const placeholder: ProgressResponse["days"] = Array.from({ length: 7 }, (_, i) => ({
    date: addDaysIso(start, i),
    // Days ahead have nothing yet and can't be picked.
    calories: addDaysIso(start, i) > todayIso ? null : 0,
  }));
  return q.data ? (
    <WeekRow week={q.data} selected={selected} todayIso={todayIso} onPick={onPick} />
  ) : (
    <WeekRow week={{ days: placeholder, goal: null }} selected={selected} todayIso={todayIso} onPick={onPick} />
  );
}

/** One week: dashed for nothing logged, a ring for logged, filled for on target; today is raised. */
function WeekRow({
  week,
  selected,
  todayIso,
  onPick,
}: {
  week: Pick<ProgressResponse, "days" | "goal">;
  selected: string;
  todayIso: string;
  onPick: (date: string, isToday: boolean) => void;
}) {
  const band = week.goal ? (week.goal.targetCalories * week.goal.bandPct) / 100 : null;
  return (
    <View style={styles.week}>
      {week.days.map((d, i) => {
        const future = d.calories === null;
        const logged = (d.calories ?? 0) > 0;
        const onTarget =
          logged && week.goal && band !== null && Math.abs(d.calories! - week.goal.targetCalories) <= band;
        const isSel = d.date === selected;
        return (
          <Pressable
            key={d.date}
            disabled={future}
            accessibilityRole="button"
            accessibilityLabel={`${WEEKDAY[i]} ${Number(d.date.slice(8))}${logged ? ", logged" : ""}`}
            onPress={() => onPick(d.date, d.date === todayIso)}
            style={[styles.day, isSel && styles.daySel]}
          >
            <T variant="caption" tone={future ? "faint" : undefined}>
              {WEEKDAY[i]}
            </T>
            <View
              style={[
                styles.dayDot,
                !logged && !future && styles.dayEmpty,
                logged && styles.dayLogged,
                onTarget && styles.dayOnTarget,
                future && { opacity: 0.4 },
              ]}
            >
              <T style={[styles.dayNum, onTarget && { color: colors.white }]}>{Number(d.date.slice(8))}</T>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Kimbo speaks first: one line for right now. Tapping it opens Ask Kimbo. */
function KimboLine() {
  const home = useQuery({ queryKey: ["assistant"], queryFn: api.assistantHome, staleTime: 60_000 });
  const line = home.data?.greeting;
  if (!line) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens Ask Kimbo"
      onPress={() => router.push("/assistant")}
      style={({ pressed }) => [styles.kimboLine, pressed && { opacity: 0.85 }]}
    >
      <Kimbo mood={line.mood} size={36} />
      <T variant="bodyStrong" style={{ flex: 1 }} numberOfLines={3}>
        {line.text}
      </T>
      <Icon name="chevron-right" size={18} color={colors.leafDeep} />
    </Pressable>
  );
}

/** One number for the day, Cal AI-style. Tapping opens the full nutrition view. */
function CaloriesCard({ data }: { data: TodayResponse }) {
  const target = data.targets?.calories ?? 0;
  const eaten = Math.round(data.totals.calories);
  return (
    <Surface onPress={() => router.push("/nutrition")} accessibilityLabel={`${eaten} of ${target} kilocalories eaten`}>
      <View style={styles.calRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <T style={styles.calBig}>{eaten.toLocaleString("en-IN")}</T>
            <T variant="title" tone="soft">
              /{target.toLocaleString("en-IN")}
            </T>
          </View>
          <T variant="label">kcal eaten</T>
        </View>
        <Ring value={eaten} max={target || 1} size={96} stroke={9}>
          <T style={styles.ringNum}>{Math.abs(target - eaten).toLocaleString("en-IN")}</T>
          <T variant="caption">{eaten > target ? "over" : "left"}</T>
        </Ring>
      </View>
    </Surface>
  );
}

/** Small cards that swipe: the macros first, then fibre, sat fat and the focus. */
function MacroCarousel({ data }: { data: TodayResponse }) {
  const { width } = useWindowDimensions();
  const pageW = width;
  const [page, setPage] = useState(0);
  const t = data.targets;
  const pages: {
    label: string;
    value: number;
    max: number;
    unit: string;
    color: string;
    limit?: boolean;
  }[][] = [
    [
      {
        label: "Protein",
        value: data.totals.protein,
        max: t?.protein ?? 0,
        unit: "g",
        color: macroColors.protein,
      },
      {
        label: "Carbs",
        value: data.totals.carbs,
        max: t?.carbs ?? 0,
        unit: "g",
        color: macroColors.carbs,
      },
      { label: "Fat", value: data.totals.fat, max: t?.fat ?? 0, unit: "g", color: macroColors.fat },
    ],
    [
      {
        label: "Fibre",
        value: data.totals.fibre,
        max: t?.fibre ?? 0,
        unit: "g",
        color: macroColors.fibre,
      },
      {
        label: "Sat fat",
        value: data.totals.satFat,
        max: t?.satFat ?? 0,
        unit: "g",
        color: colors.plum,
        limit: true,
      },
      {
        label: "Helped focus",
        value: data.focusSummary?.supported ?? 0,
        max: Math.max(1, data.focusSummary?.total ?? 0),
        unit: "",
        color: colors.leaf,
      },
    ],
  ];
  return (
    <View style={{ gap: space.sm }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / pageW))}
        style={{ marginHorizontal: -space.xl }}
      >
        {pages.map((cards, p) => (
          <View key={p} style={[styles.page, { width: pageW, paddingHorizontal: space.xl }]}>
            {cards.map((c) => (
              <View key={c.label} style={styles.mini}>
                <T style={styles.miniValue}>
                  {Math.round(c.value)}
                  <T variant="caption">
                    {" "}
                    /{Math.round(c.max)}
                    {c.unit}
                  </T>
                </T>
                <T variant="caption" numberOfLines={1}>
                  {c.limit ? `${c.label} limit` : c.label}
                </T>
                <Ring value={c.value} max={c.max || 1} size={58} stroke={6} color={c.color}>
                  <T style={[styles.ringPct, { color: c.color }]}>{c.max ? Math.round((c.value / c.max) * 100) : 0}%</T>
                </Ring>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
      <View style={styles.pager}>
        {pages.map((_, i) => (
          <View key={i} style={[styles.pagerDot, i === page && styles.pagerDotOn]} />
        ))}
      </View>
    </View>
  );
}

/** Sketch-like empty state, with "same as yesterday" when there is something to repeat. */
function EmptyMeals({ canRepeat }: { canRepeat: TodayMeal["mealType"][] }) {
  const afterWrite = useAfterWrite();
  const repeat = useMutation({
    mutationFn: (type: TodayMeal["mealType"]) => api.repeatYesterday(type),
    onSuccess: (res) => afterWrite(res.events),
  });
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push("/log")} style={styles.empty}>
      <View style={styles.sketch}>
        <View style={styles.sketchCard}>
          <Kimbo mood="sleepy" size={34} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={[styles.sketchLine, { width: "70%" }]} />
            <View style={[styles.sketchLine, { width: "45%" }]} />
          </View>
        </View>
        <View style={styles.sketchShadow} />
      </View>
      <T variant="label" align="center">
        Tap + to add your first meal of the day
      </T>
      {canRepeat.length ? (
        <View style={styles.repeatRow}>
          {canRepeat.map((type) => (
            <Pressable
              key={type}
              accessibilityRole="button"
              disabled={repeat.isPending}
              onPress={() => repeat.mutate(type)}
              style={styles.repeatChip}
            >
              <Icon name="rotate-ccw" size={13} color={colors.leaf} />
              <T variant="caption" tone="leaf">
                {MEAL_LABEL[type]} like yesterday
              </T>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function MealCard({ meal }: { meal: TodayMeal }) {
  const startEdit = useDraft((s) => s.startEdit);
  const open = async () => {
    const { foods } = await api.searchFoods("");
    startEdit(meal, Object.fromEntries(foods.map((f) => [f.id, f])));
    router.push("/review");
  };
  return (
    <Surface onPress={open} accessibilityLabel={`${MEAL_LABEL[meal.mealType]}, ${meal.totals.calories} kilocalories`}>
      <View style={styles.rowCenter}>
        <View style={styles.mealIcon}>
          <Icon name={MEAL_ICON[meal.mealType]} size={18} color={colors.leafDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="heading">{MEAL_LABEL[meal.mealType]}</T>
          <T variant="label" numberOfLines={1}>
            {new Date(meal.eatenAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </T>
        </View>
        <T variant="heading">{meal.totals.calories}</T>
        <T variant="caption">kcal</T>
      </View>
      <T variant="body" numberOfLines={2}>
        {meal.items.map((i) => i.name).join(" · ")}
      </T>
      {meal.supportsFocus ? (
        <View style={styles.helped}>
          <Icon name="check" size={14} color={colors.leafDeep} />
          <T variant="caption" tone="leaf" numberOfLines={2} style={{ flex: 1 }}>
            {meal.focusReason}
          </T>
        </View>
      ) : meal.focusReason ? (
        <T variant="caption">{meal.focusReason}</T>
      ) : null}
    </Surface>
  );
}

function DemoBanner() {
  const clear = useSession((s) => s.clear);
  return (
    <View style={styles.demo}>
      <Icon name="eye" size={16} color={colors.turmericDeep} />
      <T variant="label" style={{ flex: 1, color: colors.ink }}>
        Sample data
      </T>
      <T
        variant="label"
        tone="leaf"
        onPress={async () => {
          await clear();
          router.replace("/welcome");
        }}
      >
        Start fresh
      </T>
    </View>
  );
}

/**
 * On mount and whenever the app returns to the foreground, let Kimbo greet someone
 * coming back after a break. The API decides; each break is greeted only once.
 */
function useWelcomeBack() {
  const push = useMoments((s) => s.push);
  useEffect(() => {
    const checkin = () =>
      api
        .checkin()
        .then((r) => push(r.events))
        .catch(() => {});
    checkin();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkin();
    });
    return () => sub.remove();
  }, [push]);
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm, zIndex: 10 },
  wordmark: { fontSize: 30, lineHeight: 36 },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  streakText: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  week: { flexDirection: "row", justifyContent: "space-between" },
  day: {
    alignItems: "center",
    gap: 6,
    paddingVertical: space.sm,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    minWidth: 42,
  },
  daySel: { backgroundColor: colors.surface, ...shadow.card },
  dayDot: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  dayEmpty: { borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.lineStrong },
  dayLogged: { borderWidth: 2, borderColor: colors.leaf },
  dayOnTarget: { backgroundColor: colors.leaf },
  dayNum: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  kimboLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.leafSoft,
  },
  calRow: { flexDirection: "row", alignItems: "center", gap: space.lg },
  ringNum: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  ringPct: { fontFamily: fonts.bold, fontSize: 13 },
  calBig: { fontFamily: fonts.display, fontSize: 48, lineHeight: 54, color: colors.ink },
  page: { flexDirection: "row", gap: space.sm },
  mini: {
    flex: 1,
    gap: 4,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: "flex-start",
    ...shadow.card,
  },
  miniValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  pager: { flexDirection: "row", justifyContent: "center", gap: 6 },
  pagerDot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: colors.inkFaint },
  pagerDotOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  empty: {
    alignItems: "center",
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.sunk,
  },
  sketch: { width: "80%", alignItems: "center" },
  sketchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    width: "100%",
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  sketchShadow: {
    width: "92%",
    height: 8,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    backgroundColor: colors.surface,
    opacity: 0.6,
  },
  sketchLine: { height: 8, borderRadius: 4, backgroundColor: colors.sunk },
  repeatRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.sm },
  repeatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: space.md },
  mealIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.leafSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  helped: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.leafSoft,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
  },
  demo: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.turmericSoft,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
});
