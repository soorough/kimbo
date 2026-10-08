import type { Diet, KimboMood, MealDraft, MealType, ProgressResponse, TodayMeal, TodayResponse } from "@kimbo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, AppState, Easing, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Button } from "@/components/Button";
import { ExerciseEntryCard, WaterEntryCard } from "@/components/ActivityCards";
import { DayNumbers, PROTEIN_ICON } from "@/components/DayNumbers";
import { mealTitle } from "@/lib/meal-title";
import { Kimbo } from "@/components/Kimbo";
import { TypeOut } from "@/components/TypeOut";
import { useMoments } from "@/components/Moments";
import { TodaySkeleton } from "@/components/Skeleton";
import { ErrorState, Icon, Screen, Surface, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { MEAL_LABEL } from "@/lib/format";
import { useAfterWrite } from "@/lib/mutations";
import { useIntro } from "@/lib/intro";
import { useReduceMotion } from "@/lib/motion";
import { useSession } from "@/lib/session";
import { colors, fonts, radius, shadow, space } from "@/lib/theme";

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
  const diet = profile.data?.profile.diet ?? null;
  const isToday = date === null;

  return (
    <Screen>
      <View style={styles.header}>
        {/* Kimbo as the logo, like an app mark before its name. */}
        <Kimbo mood="happy" size={38} leaves={2} />
        <T variant="display" style={styles.wordmark}>
          kimbo
        </T>
        <View style={{ flex: 1 }} />
        <StreakPill days={week.data?.streak ?? 0} />
      </View>

      {week.data ? (
        <WeekStrip week={week.data} selected={data.date} onPick={(d, isNow) => setDate(isNow ? null : d)} />
      ) : null}

      {profile.data?.profile.isDemo ? <DemoBanner /> : null}

      {isToday ? <KimboLine /> : null}

      <DayNumbers data={data} diet={diet} />

      <View style={{ gap: space.md }}>
        <T variant="heading">{isToday ? "Recently logged" : "Logged"}</T>
        {/* Meals, water and workouts together, newest first (Cal AI's "Recently uploaded"). */}
        {recent(data).map((r) =>
          r.kind === "meal" ? (
            <MealCard key={r.item.id} meal={r.item} diet={diet} />
          ) : r.kind === "water" ? (
            <WaterEntryCard key={r.item.id} entry={r.item} />
          ) : (
            <ExerciseEntryCard key={r.item.id} entry={r.item} />
          ),
        )}
        {data.meals.length ? null : <EmptyMeals canRepeat={isToday ? data.repeatableMealTypes : []} />}
      </View>
    </Screen>
  );
}

type TodayDiet = Diet | null;

type Recent =
  | { kind: "meal"; at: string; item: TodayResponse["meals"][number] }
  | { kind: "water"; at: string; item: TodayResponse["water"]["entries"][number] }
  | { kind: "exercise"; at: string; item: TodayResponse["exercise"]["entries"][number] };

function recent(data: TodayResponse): Recent[] {
  return [
    ...data.meals.map((item): Recent => ({ kind: "meal", at: item.eatenAt, item })),
    ...data.water.entries.map((item): Recent => ({ kind: "water", at: item.loggedAt, item })),
    ...data.exercise.entries.map((item): Recent => ({ kind: "exercise", at: item.loggedAt, item })),
  ].sort((a, b) => b.at.localeCompare(a.at));
}

function StreakPill({ days }: { days: number }) {
  return (
    <Pressable
      style={styles.streak}
      accessibilityRole="button"
      accessibilityLabel={`${days} day streak. Open milestones`}
      onPress={() => router.push("/milestones")}
    >
      <T style={styles.streakFire}>🔥</T>
      <T style={styles.streakText}>{days}</T>
    </Pressable>
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
    <WeekRow week={{ days: placeholder }} selected={selected} todayIso={todayIso} onPick={onPick} />
  );
}

/** One week, Cal AI-style: past days dashed, today a solid ring, days ahead faded. The picked day is raised. */
function WeekRow({
  week,
  selected,
  todayIso,
  onPick,
}: {
  week: Pick<ProgressResponse, "days">;
  selected: string;
  todayIso: string;
  onPick: (date: string, isToday: boolean) => void;
}) {
  return (
    <View style={styles.week}>
      {week.days.map((d, i) => {
        const future = d.date > todayIso;
        const isToday = d.date === todayIso;
        const isSel = d.date === selected;
        return (
          <Pressable
            key={d.date}
            disabled={future}
            accessibilityRole="button"
            accessibilityLabel={`${WEEKDAY[i]} ${Number(d.date.slice(8))}`}
            onPress={() => onPick(d.date, isToday)}
            style={[styles.day, isSel && styles.daySel]}
          >
            <T variant="caption" tone={future ? "faint" : undefined}>
              {WEEKDAY[i]}
            </T>
            <View style={[styles.dayDot, isToday ? styles.dayToday : future ? styles.dayFuture : styles.dayPast]}>
              <T style={[styles.dayNum, future && { color: colors.inkFaint }]}>{Number(d.date.slice(8))}</T>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Kimbo speaks first: one line for right now. When it suggests a meal, tapping opens that
 * meal ready to save; otherwise it opens Ask Kimbo.
 */
function KimboLine() {
  const home = useQuery({ queryKey: ["assistant"], queryFn: api.assistantHome, staleTime: 60_000 });
  const line = home.data?.greeting;
  if (!line) return null;
  const log = line.actions.find((a) => a.kind === "log_meal" && a.draft);
  const chat = () => router.push("/assistant");

  // No meal to suggest: the whole line opens Ask Kimbo.
  if (log?.kind !== "log_meal" || !log.draft) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens Ask Kimbo"
        onPress={chat}
        style={({ pressed }) => [styles.kimboLine, styles.kimboRow, pressed && { opacity: 0.85 }]}
      >
        <Kimbo mood={line.mood} size={36} />
        <T variant="bodyStrong" style={{ flex: 1 }} numberOfLines={4}>
          {line.text}
        </T>
        <Icon name="chevron-right" size={18} color={colors.leafDeep} />
      </Pressable>
    );
  }

  return <MealNudge text={line.text} mood={line.mood} mealType={log.mealType} draft={log.draft} />;
}

const MEAL_EMOJI: Record<MealType, string> = { breakfast: "☕", lunch: "🍛", snack: "🍎", dinner: "🌙" };

/**
 * Kimbo's meal suggestion, said like a little moment: Kimbo thinks while the words type in,
 * hops when done, then the actions slide in and the Log pill breathes once.
 */
function MealNudge({
  text,
  mood,
  mealType,
  draft,
}: {
  text: string;
  mood: KimboMood;
  mealType: MealType;
  draft: MealDraft;
}) {
  const startFromAi = useDraft((s) => s.startFromAi);
  const still = useReduceMotion();
  const introDone = useIntro((s) => s.done);
  // Types in every time Today opens; only reduced motion shows it at once.
  const seen = still;
  const [typed, setTyped] = useState(seen);
  const footer = useRef(new Animated.Value(seen ? 1 : 0)).current;
  const breathe = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!typed || seen) return;
    Animated.sequence([
      Animated.spring(footer, { toValue: 1, damping: 14, stiffness: 160, useNativeDriver: true }),
      Animated.delay(250),
      Animated.timing(breathe, { toValue: 1.07, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 1, duration: 320, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [typed, seen, text, footer, breathe]);

  const label = MEAL_LABEL[mealType];
  return (
    <View style={styles.kimboLine}>
      <View style={styles.kimboHead}>
        <Kimbo mood={typed ? mood : "thinking"} size={30} />
        <T variant="overline" tone="leaf">
          {`${label} time ${MEAL_EMOJI[mealType]}`.toUpperCase()}
        </T>
      </View>
      {/* Kimbo starts talking once the launch intro is out of the way. */}
      {introDone || seen ? (
        <TypeOut text={text} variant="bodyStrong" numberOfLines={4} instant={seen} onDone={() => setTyped(true)} />
      ) : (
        <T variant="bodyStrong" numberOfLines={4} style={{ opacity: 0 }}>
          {text}
        </T>
      )}
      <Animated.View
        style={[
          styles.kimboActions,
          { opacity: footer, transform: [{ translateY: footer.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Opens Ask Kimbo"
          hitSlop={8}
          onPress={() => router.push({ pathname: "/assistant", params: { intent: "else" } })}
          style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.6 }]}
        >
          <T variant="label" tone="soft">
            Something else?{" "}
            <T variant="label" tone="leaf" style={{ fontFamily: fonts.bold }}>
              Ask Kimbo
            </T>
          </T>
        </Pressable>
        <Animated.View style={{ transform: [{ scale: breathe }] }}>
          <Button
            label="I'll have it"
            accessibilityHint={`Opens this ${label.toLowerCase()}, ready to log`}
            compact
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              startFromAi(draft, "repeat", mealType);
              router.push("/review");
            }}
          />
        </Animated.View>
      </Animated.View>
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

/** A meal in Recently logged, Cal AI-style: what it was, calories consumed, the macros. Opens the meal. */
function MealCard({ meal, diet }: { meal: TodayMeal; diet: TodayDiet }) {
  return (
    <Surface
      onPress={() => router.push({ pathname: "/meal", params: { id: meal.id } })}
      accessibilityLabel={`${mealTitle(meal)}, ${Math.round(meal.totals.calories)} calories`}
    >
      <View style={styles.rowCenter}>
        <T variant="heading" style={{ flex: 1 }} numberOfLines={1}>
          {mealTitle(meal)}
        </T>
        <T variant="caption">
          {MEAL_LABEL[meal.mealType]} · {new Date(meal.eatenAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </T>
      </View>
      <T variant="body">
        <T variant="heading">{Math.round(meal.totals.calories)} Calories</T>
        <T variant="label"> consumed</T>
      </T>
      <View style={styles.macroRow}>
        {(
          [
            [PROTEIN_ICON[diet ?? "vegetarian"], meal.totals.protein],
            ["🌾", meal.totals.carbs],
            ["🥜", meal.totals.fat],
          ] as const
        ).map(([icon, g]) => (
          <View key={icon} style={styles.macroItem}>
            <T style={{ fontSize: 13 }}>{icon}</T>
            <T variant="label">{Math.round(g)}g</T>
          </View>
        ))}
        {meal.supportsFocus ? (
          <View style={styles.macroItem}>
            <Icon name="check" size={13} color={colors.leafDeep} />
            <T variant="caption" tone="leaf">
              Helped your focus
            </T>
          </View>
        ) : null}
      </View>
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
  streakFire: { fontSize: 16, lineHeight: 24, includeFontPadding: false, textAlignVertical: "center" },
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
  dayPast: { borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.lineStrong },
  dayToday: { borderWidth: 2, borderColor: colors.ink },
  dayFuture: { borderWidth: 1.5, borderColor: colors.line },
  dayNum: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  kimboLine: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.leafSoft,
  },
  kimboRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  kimboHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  kimboActions: { flexDirection: "row", alignItems: "center", gap: space.md },
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
  macroRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.md },
  macroItem: { flexDirection: "row", alignItems: "center", gap: 4 },
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
