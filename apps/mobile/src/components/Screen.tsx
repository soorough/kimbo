import { router } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { scrollHandlers } from "@/lib/scrolling";
import { colors, space } from "@/lib/theme";
import { Icon } from "./Icon";
import { T } from "./Text";

/**
 * Page scaffold: paper background, optional back header, scrolling body and an
 * optional sticky footer for the screen's one primary action.
 */
export function Screen({
  children,
  title,
  back,
  footer,
  scroll = true,
  padded = true,
}: {
  children: ReactNode;
  title?: string;
  back?: boolean;
  footer?: ReactNode;
  scroll?: boolean;
  padded?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const body = [padded && styles.padded, { paddingBottom: footer ? space.xl : space.xxxl * 3 }];
  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      {/* Keeps the sticky footer above the keyboard (edge-to-edge Android no longer resizes for it). */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {back || title ? (
          <View style={styles.header}>
            {back ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={() => router.back()}
                hitSlop={12}
                style={styles.back}
              >
                <Icon name="arrow-left" size={22} />
              </Pressable>
            ) : null}
            {title ? <T variant="title">{title}</T> : null}
          </View>
        ) : null}
        {scroll ? (
          <ScrollView
            contentContainerStyle={body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            {...scrollHandlers}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, body]}>{children}</View>
        )}
        {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  padded: { paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.lg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    backgroundColor: colors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
