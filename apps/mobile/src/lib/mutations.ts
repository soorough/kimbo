import type { KimboEvent } from "@kimbo/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useMoments } from "@/components/Moments";

/** After any write: refresh Today/Progress and play Kimbo's moments. */
export function useAfterWrite() {
  const queryClient = useQueryClient();
  const push = useMoments((s) => s.push);
  return async (events: KimboEvent[] = []) => {
    await queryClient.invalidateQueries();
    push(events);
  };
}
