import type { AssistantAction, AssistantQuestion, AssistantReply, AssistantTurn } from "@kimbo/shared";
import { useQuery } from "@tanstack/react-query";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
} from "expo-audio";
import { readAsStringAsync } from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Kimbo } from "@/components/Kimbo";
import { Icon, T, type IconName } from "@/components/ui";
import { api, errorMessage, speechSource } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { useReduceMotion } from "@/lib/motion";
import { colors, fonts, radius, shadow, space } from "@/lib/theme";

type Message =
  | { id: number; from: "user"; text: string }
  | { id: number; from: "kimbo"; reply: AssistantReply }
  | { id: number; from: "kimbo"; thinking: true };

/** Rotating hints teach what to ask (and that voice works) without a tutorial. */
const HINTS = [
  "Ask anything…",
  "Try: what should I eat for dinner?",
  "Try: is poha good for my report?",
  "Tap the mic to talk",
];

/** Big, friendly starting points so nobody faces a blank box. */
const CARD_STYLE: Record<AssistantQuestion, { icon: IconName; bg: string; fg: string }> = {
  what_to_eat: { icon: "coffee", bg: colors.leafSoft, fg: colors.leafDeep },
  why_focus: { icon: "file-text", bg: colors.turmericSoft, fg: colors.turmericDeep },
  how_am_i_doing: { icon: "trending-up", bg: colors.plumSoft, fg: colors.plum },
};

/**
 * Ask Kimbo: a personal assistant that speaks first, answers from the user's own data
 * (targets, meals, report, diet) and never invents health facts. Replies type out,
 * can be heard in Kimbo's voice (ElevenLabs), and end in one useful action.
 */
export default function Assistant() {
  const insets = useSafeAreaInsets();
  const home = useQuery({ queryKey: ["assistant"], queryFn: api.assistantHome });
  const startFromAi = useDraft((s) => s.startFromAi);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [voiceOn, setVoiceOn] = useState(true);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const nextId = useRef(1);
  const scroll = useRef<ScrollView>(null);
  const player = useAudioPlayer(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const busy = messages.some((m) => "thinking" in m);
  const hint = useRotatingHint();

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const speak = (line: string) => {
    if (!voiceOn) return;
    try {
      player.replace(speechSource(line));
      player.play();
    } catch {
      // Voice is a bonus: the text is always there.
    }
  };

  type NewMessage = { from: "user"; text: string } | { from: "kimbo"; thinking: true };
  const push = (m: NewMessage) => {
    const id = nextId.current++;
    setMessages((all) => [...all, { ...m, id } as Message]);
    return id;
  };

  const send = async (input: { question: AssistantQuestion; label: string } | { text: string }) => {
    if (busy) return;
    setNotice(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const asked = "label" in input ? input.label : input.text;
    const history: AssistantTurn[] = messages
      .slice(-6)
      .flatMap((m): AssistantTurn[] =>
        m.from === "user"
          ? [{ role: "user", text: m.text }]
          : "reply" in m
            ? [{ role: "kimbo", text: m.reply.text }]
            : [],
      );
    push({ from: "user", text: asked });
    const thinkingId = push({ from: "kimbo", thinking: true });
    try {
      const { reply } = await api.ask(
        "question" in input ? { question: input.question } : { text: input.text, history },
      );
      setMessages((all) => all.map((m) => (m.id === thinkingId ? { id: m.id, from: "kimbo", reply } : m)));
      speak(reply.text);
    } catch (err) {
      setMessages((all) =>
        all.map((m) =>
          m.id === thinkingId
            ? {
                id: m.id,
                from: "kimbo",
                reply: {
                  mood: "thinking",
                  text: `${errorMessage(err)} Try again in a moment.`,
                  points: [],
                  actions: [],
                },
              }
            : m,
        ),
      );
    }
  };

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    send({ text: t });
  };

  /** Tap to start, tap again to send. ElevenLabs turns the recording into text. */
  const toggleMic = async () => {
    if (listening) {
      setListening(false);
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) return;
        const audioBase64 = await readAsStringAsync(uri, { encoding: "base64" });
        const { text: heard } = await api.listen({ audioBase64, mimeType: "audio/m4a" });
        if (heard) send({ text: heard });
        else setNotice("I didn't catch that. Try again, or type it.");
      } catch {
        setNotice("I can't listen right now. You can type instead.");
      }
      return;
    }
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setNotice("Allow the microphone to talk to Kimbo.");
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      player.pause();
      await recorder.prepareToRecordAsync();
      recorder.record();
      setListening(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch {
      setNotice("I can't listen right now. You can type instead.");
    }
  };

  const act = (a: AssistantAction) => {
    if (a.kind === "log_meal" && a.draft) {
      startFromAi(a.draft, "repeat", a.mealType);
      router.push("/review");
    } else if (a.kind === "log_meal") router.push({ pathname: "/log", params: { mealType: a.mealType } });
    else if (a.screen === "nutrition") router.push("/nutrition");
    else router.navigate(a.screen === "report" ? "/(tabs)/report" : "/(tabs)/progress");
  };

  const greeting = home.data?.greeting;
  const empty = messages.length === 0;

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.round}
          >
            <Icon name="x" size={20} />
          </Pressable>
          <T variant="heading" style={{ flex: 1, textAlign: "center" }}>
            Ask Kimbo
          </T>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: voiceOn }}
            accessibilityLabel="Kimbo speaks replies"
            hitSlop={12}
            onPress={() => {
              if (voiceOn) player.pause();
              setVoiceOn(!voiceOn);
              Haptics.selectionAsync().catch(() => {});
            }}
            style={[styles.round, voiceOn && { backgroundColor: colors.leafSoft }]}
          >
            <Icon
              name={voiceOn ? "volume-2" : "volume-x"}
              size={20}
              color={voiceOn ? colors.leafDeep : colors.inkSoft}
            />
          </Pressable>
        </View>

        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          {empty ? (
            <View style={styles.hero}>
              <Kimbo mood={greeting?.mood ?? "wave"} size={112} leaves={2} />
              {greeting ? (
                <TypeOut text={greeting.text} variant="title" align="center" onDone={() => {}} />
              ) : (
                <T variant="title" align="center" tone="soft">
                  …
                </T>
              )}
              <View style={styles.cards}>
                {home.data?.suggestions.map((s, i) => {
                  const look = CARD_STYLE[s.question];
                  return (
                    <PopIn key={s.question} delay={250 + i * 90} style={i === 0 ? styles.cardWide : styles.cardHalf}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => send({ question: s.question, label: s.label })}
                        style={({ pressed }) => [
                          styles.card,
                          { backgroundColor: look.bg },
                          pressed && { transform: [{ scale: 0.97 }] },
                        ]}
                      >
                        <View style={[styles.cardIcon, { backgroundColor: colors.surface }]}>
                          <Icon name={look.icon} size={20} color={look.fg} />
                        </View>
                        <T variant="bodyStrong" style={{ color: look.fg }}>
                          {s.label}
                        </T>
                        <Icon name="arrow-right" size={18} color={look.fg} />
                      </Pressable>
                    </PopIn>
                  );
                })}
              </View>
            </View>
          ) : (
            messages.map((m) =>
              m.from === "user" ? (
                <PopIn key={m.id} style={styles.userRow}>
                  <View style={styles.userBubble}>
                    <T variant="body" style={{ color: colors.white }}>
                      {m.text}
                    </T>
                  </View>
                </PopIn>
              ) : (
                <PopIn key={m.id} style={styles.kimboRow}>
                  <Kimbo mood={"thinking" in m ? "thinking" : m.reply.mood} size={40} />
                  <View style={styles.kimboBubble}>
                    {"thinking" in m ? (
                      <Dots />
                    ) : (
                      <KimboAnswer
                        reply={m.reply}
                        onAct={act}
                        onReplay={voiceOn ? () => speak(m.reply.text) : undefined}
                      />
                    )}
                  </View>
                </PopIn>
              ),
            )
          )}
          {notice ? (
            <T variant="label" tone="plum" align="center">
              {notice}
            </T>
          ) : null}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, space.sm) + space.sm }]}>
          {listening ? (
            <Listening onStop={toggleMic} />
          ) : (
            <View style={styles.field}>
              <TextInput
                value={text}
                onChangeText={setText}
                onSubmitEditing={submit}
                placeholder={hint}
                placeholderTextColor={colors.inkFaint}
                returnKeyType="send"
                maxLength={300}
                style={styles.input}
                accessibilityLabel="Ask Kimbo"
              />
              {text.trim() ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send"
                  onPress={submit}
                  style={[styles.round, styles.send]}
                >
                  <Icon name="arrow-up" size={20} color={colors.white} />
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Talk to Kimbo"
                  onPress={toggleMic}
                  style={[styles.round, styles.mic]}
                >
                  <Icon name="mic" size={20} color={colors.leafDeep} />
                </Pressable>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function useRotatingHint() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % HINTS.length), 3200);
    return () => clearInterval(t);
  }, []);
  return HINTS[i]!;
}

/** Kimbo's answer: the sentence types out, then the points and actions arrive. */
function KimboAnswer({
  reply,
  onAct,
  onReplay,
}: {
  reply: AssistantReply;
  onAct: (a: AssistantAction) => void;
  onReplay?: () => void;
}) {
  const [typed, setTyped] = useState(false);
  return (
    <View style={{ gap: space.sm }}>
      <TypeOut
        text={reply.text}
        variant="body"
        onDone={() => {
          setTyped(true);
          Haptics.selectionAsync().catch(() => {});
        }}
      />
      {typed && reply.points.length ? (
        <PopIn style={{ gap: 6 }}>
          {reply.points.map((p) => (
            <View key={p} style={styles.point}>
              <View style={styles.pointDot} />
              <T variant="label" style={{ flex: 1, color: colors.ink }}>
                {p}
              </T>
            </View>
          ))}
        </PopIn>
      ) : null}
      {typed && (reply.actions.length || onReplay) ? (
        <PopIn style={styles.actions}>
          {reply.actions.map((a) => (
            <Pressable key={a.label} accessibilityRole="button" onPress={() => onAct(a)} style={styles.actionChip}>
              <T variant="label" style={{ color: colors.white, fontFamily: fonts.semibold }}>
                {a.label}
              </T>
            </Pressable>
          ))}
          {onReplay ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hear it again"
              onPress={onReplay}
              style={styles.replay}
            >
              <Icon name="volume-2" size={16} color={colors.leafDeep} />
            </Pressable>
          ) : null}
        </PopIn>
      ) : null}
    </View>
  );
}

/** Reveals text word by word, like Kimbo is saying it. Instant when motion is reduced. */
function TypeOut({
  text,
  variant,
  align,
  onDone,
}: {
  text: string;
  variant: "body" | "title";
  align?: "center";
  onDone: () => void;
}) {
  const still = useReduceMotion();
  const words = text.split(" ");
  const [n, setN] = useState(still ? words.length : 0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (still) {
      setN(words.length);
      done.current();
      return;
    }
    setN(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= words.length) {
        clearInterval(t);
        done.current();
      }
    }, 45);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, still]);
  return (
    <T variant={variant} align={align} style={variant === "title" ? { fontSize: 24, lineHeight: 31 } : undefined}>
      {words.slice(0, n).join(" ")}
      {/* The rest is laid out invisibly so the bubble doesn't grow line by line. */}
      <T variant={variant} style={{ opacity: 0 }}>
        {n < words.length ? ` ${words.slice(n).join(" ")}` : ""}
      </T>
    </T>
  );
}

/** Small spring-in for anything that arrives. */
function PopIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: object }) {
  const still = useReduceMotion();
  const v = useRef(new Animated.Value(still ? 1 : 0)).current;
  useEffect(() => {
    if (still) return;
    Animated.spring(v, { toValue: 1, delay, damping: 14, stiffness: 180, useNativeDriver: true }).start();
  }, [v, delay, still]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Kimbo thinking: three dots that bob in turn. */
function Dots() {
  const vs = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = vs.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(v, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay((2 - i) * 140),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [vs]);
  return (
    <View style={styles.dots} accessibilityLabel="Kimbo is thinking">
      {vs.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] },
          ]}
        />
      ))}
    </View>
  );
}

/** While recording: a breathing mic and one clear way to finish. */
function Listening({ onStop }: { onStop: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Stop and send" onPress={onStop} style={styles.listening}>
      <Animated.View
        style={[
          styles.pulse,
          {
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.1] }),
          },
        ]}
      />
      <View style={[styles.round, { backgroundColor: colors.leaf }]}>
        <Icon name="mic" size={20} color={colors.white} />
      </View>
      <T variant="bodyStrong" style={{ flex: 1 }}>
        Listening… tap to send
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    gap: space.md,
  },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  body: { padding: space.lg, gap: space.md, flexGrow: 1 },
  hero: { alignItems: "center", gap: space.lg, paddingTop: space.xl },
  cards: { flexDirection: "row", flexWrap: "wrap", gap: space.md, alignSelf: "stretch", marginTop: space.md },
  cardWide: { width: "100%" },
  cardHalf: { flexGrow: 1, flexBasis: "40%" },
  card: {
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    minHeight: 120,
    justifyContent: "space-between",
    ...shadow.card,
  },
  cardIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  userRow: { alignItems: "flex-end" },
  userBubble: {
    maxWidth: "82%",
    backgroundColor: colors.leaf,
    borderRadius: radius.lg,
    borderBottomRightRadius: 6,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  kimboRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  kimboBubble: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderBottomLeftRadius: 6,
    padding: space.lg,
    ...shadow.card,
  },
  point: { flexDirection: "row", alignItems: "center", gap: space.sm },
  pointDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.leaf },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm, marginTop: space.xs },
  actionChip: {
    backgroundColor: colors.leaf,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
  },
  replay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.leafSoft,
  },
  dots: { flexDirection: "row", gap: 6, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.inkFaint },
  inputBar: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    backgroundColor: colors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingLeft: space.lg,
    paddingRight: 6,
    paddingVertical: 6,
    ...shadow.card,
  },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink, paddingVertical: space.sm },
  send: { backgroundColor: colors.leaf },
  mic: { backgroundColor: colors.leafSoft },
  listening: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.leafSoft,
    borderRadius: radius.pill,
    padding: 6,
    paddingRight: space.lg,
  },
  pulse: { position: "absolute", left: 6, width: 42, height: 42, borderRadius: 21, backgroundColor: colors.leaf },
});
