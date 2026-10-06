import { ActivityIndicator, View } from "react-native";
import { colors, space } from "@/lib/theme";
import { Button } from "./Button";
import { Kimbo, type KimboMood } from "./Kimbo";
import { T } from "./Text";

export function Loading({ label }: { label?: string }) {
  return (
    <View style={{ padding: space.xxl, alignItems: "center", gap: space.md }} accessibilityLabel={label ?? "Loading"}>
      <ActivityIndicator color={colors.leaf} />
      {label ? <T variant="label">{label}</T> : null}
    </View>
  );
}

/** Friendly empty/error state: Kimbo explains what happened and offers the next step. */
export function Notice({
  mood = "idle",
  title,
  message,
  action,
  onAction,
}: {
  mood?: KimboMood;
  title: string;
  message?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ alignItems: "center", gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.lg }}>
      <Kimbo mood={mood} size={84} />
      <T variant="heading" align="center">
        {title}
      </T>
      {message ? (
        <T variant="body" tone="soft" align="center">
          {message}
        </T>
      ) : null}
      {action && onAction ? <Button label={action} kind="secondary" compact onPress={onAction} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Notice
      mood="thinking"
      title="That didn't work"
      message={message}
      action={onRetry ? "Try again" : undefined}
      onAction={onRetry}
    />
  );
}
