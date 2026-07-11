import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { trpc } from "../../lib/trpc-client";

export interface LiveAgent {
  name: string;
  label?: string;
}

const EMPTY = new Map<string, LiveAgent>();

/**
 * Map of worktree path → the agent-dashboard orchestrator's live session for
 * that worktree (friendly name + label). Lets the sidebar label a worktree with
 * the name it was dispatched under instead of only its git branch. Polls; the
 * query dedupes across the many `WorkspaceCard`s that read it. Empty when the
 * orchestrator isn't present.
 */
export function useLiveAgents(): Map<string, LiveAgent> {
  const { data } = useQuery({
    queryKey: ["workspace", "liveAgents"],
    queryFn: () => trpc.workspace.liveAgents.query(),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
  return useMemo(() => {
    if (!data?.agents?.length) return EMPTY;
    const map = new Map<string, LiveAgent>();
    for (const a of data.agents) map.set(a.worktreePath, { name: a.name, label: a.label });
    return map;
  }, [data]);
}
