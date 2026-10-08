import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space } from "@/lib/theme";
import { Icon } from "./Icon";
import { T } from "./Text";

const SCREEN_H = Dimensions.get("window").height;
const DISMISS_DISTANCE = 120;

/**
 * Kimbo's bottom sheet: slides up over the current screen, dims what's behind it,
 * dismisses on backdrop tap, back button or a downward drag on the handle.
 * Used for short, focused tasks (log a meal, pick a food) where the user should
 * keep a sense of where they came from — a full screen would feel like leaving.
 */
export function SheetPanel({
  title,
  subtitle,
  onClose,
  children,
  maxHeight = 0.9,
}: {
  title?: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxHeight?: number;
}) {
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(SCREEN_H)).current;
  const backdrop = y.interpolate({ inputRange: [0, SCREEN_H], outputRange: [1, 0], extrapolate: "clamp" });

  useEffect(() => {
    // Critically damped: slides up and stops, no bounce past the top that flashes what's behind.
    Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 30, stiffness: 220, mass: 0.9, overshootClamping: true }).start();
  }, [y]);

  const close = () => Animated.timing(y, { toValue: SCREEN_H, duration: 200, useNativeDriver: true }).start(onClose);

  const drag = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 6,
      onPanResponderMove: (_e, g) => y.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > DISMISS_DISTANCE || g.vy > 1.2) close();
        else Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
      },
    }),
  ).current;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      </Animated.View>
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.anchor}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.panel,
            {
              maxHeight: SCREEN_H * maxHeight,
              paddingBottom: insets.bottom + space.lg,
              transform: [{ translateY: y }],
            },
          ]}
        >
          <View {...drag.panHandlers} style={styles.handleArea}>
            <View style={styles.handle} />
            {title ? (
              <View style={styles.header}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="title">{title}</T>
                  {subtitle ? <T variant="label">{subtitle}</T> : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={close}
                  hitSlop={12}
                  style={styles.close}
                >
                  <Icon name="x" size={20} color={colors.inkSoft} />
                </Pressable>
              </View>
            ) : null}
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** A sheet for in-screen tasks (no route), e.g. editing one item's portion. */
export function Sheet({
  visible,
  onClose,
  ...rest
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {/* A Modal is its own window, so it needs its own safe-area measurement. */}
      <SafeAreaProvider>{visible ? <SheetPanel onClose={onClose} {...rest} /> : null}</SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  anchor: { flex: 1, justifyContent: "flex-end" },
  panel: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
  },
  handleArea: { paddingTop: space.sm, paddingBottom: space.md },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.line,
    marginBottom: space.md,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.sunk,
    alignItems: "center",
    justifyContent: "center",
  },
});
