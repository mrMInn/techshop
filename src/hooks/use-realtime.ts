import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * Custom hook to subscribe to Postgres Realtime changes using Supabase
 * and automatically invalidate target React Query keys on any updates.
 *
 * @param table The table name in database to listen to
 * @param queryKeys Array of query keys to invalidate. E.g. [["inventory"], ["orders"]]
 */
export function useRealtimeSubscription(table: string, queryKeys: string[][]) {
  const queryClient = useQueryClient();
  const keysRef = useRef(queryKeys);
  keysRef.current = queryKeys;

  useEffect(() => {
    const supabase = createClient();
    let timeoutId: NodeJS.Timeout | null = null;

    const channel = supabase
      .channel(`realtime-db-${table}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: table,
        },
        (payload) => {
          console.log(`📡 [Realtime] Postgres change detected on [${table}]:`, payload);
          
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          
          timeoutId = setTimeout(() => {
            console.log(`📡 [Realtime] Debounced query invalidation triggered for [${table}]`);
            keysRef.current.forEach((key) => {
              queryClient.invalidateQueries({ queryKey: key });
            });
          }, 300);
        }
      )
      .subscribe((status) => {
        console.log(`📡 [Realtime] Channel subscription status for [${table}]:`, status);
      });

    return () => {
      console.log(`📡 [Realtime] Unsubscribing from channel for [${table}]`);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      supabase.removeChannel(channel);
    };
  }, [table, queryClient]);
}
