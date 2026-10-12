"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/form";
import { moveCleanToTeam, setWorkingTeams } from "@/lib/cleaning/actions";
import type { ActionState } from "@/lib/types";

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<ActionState>) {
    startTransition(async () => {
      try {
        const r = await action();
        if (r.ok) {
          if (r.message) toast.success(r.message);
          router.refresh();
        } else {
          toast.error(r.error ?? "That didn't work. Please try again.");
        }
      } catch {
        toast.error("That didn't work. Check your connection and try again.");
      }
    });
  }
  return { pending, run };
}

/** Tick the teams working on this day; the day is re-planned when saved. */
export function WorkingTeamsForm({
  day,
  teams,
  workingIds,
  overridden,
}: {
  day: string;
  teams: Array<{ id: string; name: string; works_by_default: boolean }>;
  workingIds: string[];
  overridden: boolean;
}) {
  const [chosen, setChosen] = useState<string[]>(workingIds);
  const { pending, run } = useAction();
  const changed = chosen.length !== workingIds.length || chosen.some((id) => !workingIds.includes(id));

  return (
    <div>
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-ink">Teams working this day</legend>
        <div className="flex flex-wrap gap-2">
          {teams.map((t) => {
            const on = chosen.includes(t.id);
            return (
              <label
                key={t.id}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  on ? "border-forest bg-forest text-white" : "border-line bg-white text-ink-soft hover:border-sage"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={(e) => setChosen((c) => (e.target.checked ? [...c, t.id] : c.filter((x) => x !== t.id)))}
                />
                {t.name}
                {!t.works_by_default ? <span className={`text-xs font-normal ${on ? "text-mist" : "text-ink-faint"}`}>(not usual)</span> : null}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={!changed || pending}
          onClick={() => run(() => setWorkingTeams(day, chosen))}
          icon={pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}
        >
          Save and re-plan
        </Button>
        {overridden ? (
          <Button size="sm" variant="quiet" disabled={pending} onClick={() => run(() => setWorkingTeams(day, null))}>
            Use the usual teams
          </Button>
        ) : null}
        {chosen.length === 0 ? <p className="text-sm text-brick">With no team ticked, nobody is given these cleans.</p> : null}
      </div>
    </div>
  );
}

/** Give one clean to a particular team, or leave it to the planner. */
export function MoveCleanSelect({
  bookingId,
  teams,
  currentTeamId,
  pinnedTeamId,
  label,
}: {
  bookingId: string;
  teams: Array<{ id: string; name: string }>;
  currentTeamId: string | null;
  pinnedTeamId: string | null;
  label: string;
}) {
  const { pending, run } = useAction();
  const value = pinnedTeamId ?? "auto";
  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`move-${bookingId}`}>
        {label}
      </label>
      <select
        id={`move-${bookingId}`}
        className={`${inputClasses} w-auto py-1.5 text-sm`}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          run(() => moveCleanToTeam(bookingId, v === "auto" ? null : v));
        }}
      >
        <option value="auto">Planner chooses{currentTeamId && !pinnedTeamId ? ` (${teams.find((t) => t.id === currentTeamId)?.name ?? ""})` : ""}</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            Give to {t.name}
          </option>
        ))}
      </select>
      {pending ? <Loader2 className="size-4 animate-spin text-ink-soft" aria-hidden /> : null}
    </div>
  );
}
