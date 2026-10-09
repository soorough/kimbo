import { useMutation } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, PanResponder, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Button } from "@/components/Button";
import { Kimbo } from "@/components/Kimbo";
import { Icon, T, type IconName } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { toUploadableJpeg } from "@/lib/image";
import { useReduceMotion } from "@/lib/motion";
import { colors, radius, space } from "@/lib/theme";

const TIPS_SEEN = "kimbo.scanTipsSeen";

/**
 * Cal AI's scan: straight into a full-screen camera with a framing guide and a big shutter.
 * The photo freezes on screen while Kimbo reads the plate, then the meal opens to check.
 */
export default function Scan() {
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const sheetDrag = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 5,
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy > 72 || gesture.vy > 1.1) router.back();
      },
    }),
  ).current;
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [tips, setTips] = useState(false);
  const startFromAi = useDraft((s) => s.startFromAi);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);
  useEffect(() => {
    SecureStore.getItemAsync(TIPS_SEEN)
      .then((v) => setTips(!v))
      .catch(() => {});
  }, []);

  const analyse = useMutation({
    mutationFn: async (uri: string) => {
      const image = await toUploadableJpeg(uri);
      return api.parseMeal({ imageBase64: image.base64, mimeType: image.mimeType });
    },
    onSuccess: (draft) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      startFromAi(draft, "photo");
      router.replace("/review");
    },
  });

  const use = (uri: string) => {
    setShot(uri);
    analyse.mutate(uri);
  };
  const snap = async () => {
    if (!camera.current || analyse.isPending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const pic = await camera.current.takePictureAsync({ quality: 0.7 }).catch(() => null);
    if (pic?.uri) use(pic.uri);
  };
  const library = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"] });
    const uri = res.canceled ? null : res.assets[0]?.uri;
    if (uri) use(uri);
  };
  const retake = () => {
    analyse.reset();
    setShot(null);
  };

  return (
    <View style={styles.modalRoot}>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.35)" }]}
        onPress={() => router.back()}
        accessibilityLabel="Close scan"
      />
      <View style={[styles.panel, { top: insets.top + space.sm, bottom: insets.bottom + space.xs }]}>
        {shot ? (
          <Image source={{ uri: shot }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : permission?.granted ? (
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} />
        ) : (
          <View style={styles.noCamera}>
            <Icon name="camera-off" size={36} color={colors.white} />
            <T variant="bodyStrong" align="center" style={{ color: colors.white }}>
              Kimbo needs the camera to scan your plate.
            </T>
            <Button label="Allow camera" onPress={requestPermission} />
          </View>
        )}

        {/* Soft shades keep the white controls readable over a bright plate. */}
        <Shade edge="top" />
        <Shade edge="bottom" />
        {shot ? null : <Frame />}
        {analyse.isPending ? <Reading /> : null}

        <View {...sheetDrag.panHandlers} style={styles.handleArea}>
          <View style={styles.handle} />
        </View>
        <ScrollView style={styles.panelScroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.top}>
            <Round icon="x" label="Close" onPress={() => router.back()} />
            <T variant="bodyStrong" style={{ color: colors.white }}>
              Scan food
            </T>
            {shot ? <View style={{ width: 44 }} /> : <Round icon="info" label="Hints" onPress={() => setTips(true)} />}
          </View>

          <View style={styles.bottom}>
            {analyse.error ? (
              <View style={styles.errorBox}>
                <T variant="bodyStrong" align="center">
                  {errorMessage(analyse.error)}
                </T>
                <Button label="Retake" onPress={retake} />
              </View>
            ) : shot ? null : (
              <>
                <T variant="label" align="center" style={styles.hint}>
                  Fit your whole plate in the frame
                </T>
                <View style={styles.controls}>
                  <Side icon={torch ? "zap" : "zap-off"} label="Flash" selected={torch} onPress={() => setTorch((t) => !t)} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Take photo"
                    disabled={!permission?.granted}
                    onPress={snap}
                    style={({ pressed }) => [styles.shutter, pressed && { transform: [{ scale: 0.92 }] }]}
                  >
                    <View style={styles.shutterInner} />
                  </Pressable>
                  <Side icon="image" label="Library" onPress={library} />
                </View>
              </>
            )}
          </View>
        </ScrollView>

        {tips ? (
          <Tips
            onDone={() => {
              setTips(false);
              SecureStore.setItemAsync(TIPS_SEEN, "1").catch(() => {});
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

function Shade({ edge }: { edge: "top" | "bottom" }) {
  const top = edge === "top";
  return (
    <Svg pointerEvents="none" width="100%" height={top ? 200 : 280} style={[styles.shade, top ? { top: 0 } : { bottom: 0 }]}>
      <Defs>
        <LinearGradient id={edge} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity={top ? 0.65 : 0} />
          <Stop offset="1" stopColor="#000" stopOpacity={top ? 0 : 0.6} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${edge})`} />
    </Svg>
  );
}

/** Four rounded corners marking where the plate goes, breathing gently. */
function Frame() {
  const still = useReduceMotion();
  const s = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(s, { toValue: 1.03, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(s, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [s, still]);
  return (
    <View pointerEvents="none" style={styles.frameWrap}>
      <Animated.View style={[styles.frame, { transform: [{ scale: s }] }]}>
        <View style={[styles.corner, styles.tl]} />
        <View style={[styles.corner, styles.tr]} />
        <View style={[styles.corner, styles.bl]} />
        <View style={[styles.corner, styles.br]} />
      </Animated.View>
    </View>
  );
}

/** While the photo is read: a dimmed photo, a sweeping line and Kimbo thinking. */
function Reading() {
  const still = useReduceMotion();
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(Animated.timing(y, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [y, still]);
  return (
    <View style={styles.reading} pointerEvents="none">
      <View style={styles.scanBox}>
        <Animated.View
          style={[styles.scanLine, { transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, 300] }) }] }]}
        />
      </View>
      <View style={styles.readingPill}>
        <Kimbo mood="thinking" size={32} />
        <T variant="bodyStrong">Reading your plate…</T>
      </View>
    </View>
  );
}

const TIPS: { title: string; lines: [IconName, string][] }[] = [
  { title: "Get the best scan", lines: [["maximize", "Hold still"], ["sun", "Use lots of light"], ["eye", "Keep every dish in view"]] },
  { title: "Kimbo reads your plate", lines: [["search", "Dishes are recognised"], ["clock", "Takes a few seconds"], ["pie-chart", "You'll see calories and macros"]] },
  { title: "Fix it if needed", lines: [["check-circle", "Check the dishes Kimbo found"], ["plus-circle", "Add or remove items"], ["sliders", "Change katori, roti or grams"]] },
];

function Tips({ onDone }: { onDone: () => void }) {
  const [page, setPage] = useState(0);
  const t = TIPS[page]!;
  const last = page === TIPS.length - 1;
  return (
    <View style={styles.tipsScrim}>
      <View style={styles.tips}>
        <Kimbo mood={page === 1 ? "thinking" : "happy"} size={84} />
        <T variant="title" align="center">
          {t.title}
        </T>
        <View style={{ gap: space.md, alignSelf: "stretch" }}>
          {t.lines.map(([icon, line]) => (
            <View key={line} style={styles.tipRow}>
              <Icon name={icon} size={20} color={colors.ink} />
              <T variant="body">{line}</T>
            </View>
          ))}
        </View>
        <View style={styles.dots}>
          {TIPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
        <View style={{ alignSelf: "stretch" }}>
          <Button label={last ? "Scan now" : "Next"} onPress={() => (last ? onDone() : setPage(page + 1))} />
        </View>
      </View>
    </View>
  );
}

function Round({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={styles.round}>
      <Icon name={icon} size={20} color={colors.white} />
    </Pressable>
  );
}

function Side({ icon, label, onPress, selected }: { icon: IconName; label: string; onPress: () => void; selected?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      style={styles.side}
    >
      <View style={styles.sideIcon}>
        <Icon name={icon} size={20} color={colors.white} />
      </View>
      <T variant="caption" style={{ color: colors.white }}>
        {label}
      </T>
    </Pressable>
  );
}

const CORNER = 34;
const FILL = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } as const;
const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  panel: {
    position: "absolute",
    left: space.xs,
    right: space.xs,
    backgroundColor: "#000",
    borderRadius: radius.xl,
    overflow: "hidden",
  },
  handleArea: { height: 30, alignItems: "center", justifyContent: "center", zIndex: 2 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.55)" },
  panelScroll: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "space-between" },
  noCamera: { ...FILL, alignItems: "center", justifyContent: "center", gap: space.lg, padding: space.xxl },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
  },
  shade: { position: "absolute", left: 0, right: 0 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  frameWrap: { ...FILL, alignItems: "center", justifyContent: "center" },
  frame: { width: "78%", aspectRatio: 1, marginBottom: 80 },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: colors.white },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 22 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 22 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 22 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 22 },
  bottom: { gap: space.lg, paddingHorizontal: space.xl, paddingBottom: space.xl },
  hint: { color: colors.white, opacity: 0.85 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  side: { width: 80, alignItems: "center", gap: 6 },
  sideIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 5, borderColor: colors.white, alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.white },
  reading: { ...FILL, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center", gap: space.xl },
  scanBox: { width: "78%", height: 300, overflow: "hidden", borderRadius: radius.lg, borderWidth: 2, borderColor: "rgba(255,255,255,0.6)" },
  scanLine: { height: 3, backgroundColor: colors.white, opacity: 0.9 },
  readingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  errorBox: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
  tipsScrim: { ...FILL, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  tips: {
    alignItems: "center",
    gap: space.lg,
    padding: space.xl,
    paddingBottom: space.xxxl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.paper,
  },
  tipRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.ink },
});

