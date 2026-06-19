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
          // Invalidate each of the specified React Query keys
          keysRef.current.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
          });
        }
      )
      .subscribe((status) => {
        console.log(`📡 [Realtime] Channel subscription status for [${table}]:`, status);
      });

    return () => {
      console.log(`📡 [Realtime] Unsubscribing from channel for [${table}]`);
      supabase.removeChannel(channel);
    };
  }, [table, queryClient]);
}
