"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ActionForm, CheckboxField, FormError, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { ActionButton } from "@/components/ui/action-button";
import { formatTimeFriendly } from "@/lib/format";
import { archiveCleaningTeam, saveCleaningSettings, saveCleaningTeam } from "@/lib/cleaning/actions";
import type { CleaningTeam, Settings } from "@/lib/types";

const TIMES = Array.from({ length: 31 }, (_, i) => {
  const minutes = 6 * 60 + i * 30; // 6am to 9pm
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

function timeOptions(current: string) {
  const list = TIMES.includes(current) ? TIMES : [current, ...TIMES];
  return list.map((v) => ({ value: v, label: formatTimeFriendly(v) }));
}

export function CleaningDayForm({ s }: { s: Settings }) {
  const router = useRouter();
  const start = s.clean_day_start.slice(0, 5);
  const end = s.clean_day_end.slice(0, 5);
  return (
    <ActionForm action={saveCleaningSettings} onSuccess={() => router.refresh()} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label="Teams set off from" name="clean_day_start" defaultValue={start} options={timeOptions(start)} hint="Cleans still wait for the guests to check out." />
        <SelectField label="Aim to finish by" name="clean_day_end" defaultValue={end} options={timeOptions(end)} hint="The planner adds a team's time if a run would go past this." />
      </div>
      <CheckboxField
        name="cleaning_plan_whatsapp"
        defaultChecked={s.cleaning_plan_whatsapp}
        label="Post each day's plan to the cleaners' WhatsApp group in the morning"
        description="Sent around 7am, only on days with cleans."
      />
      <FormError />
      <div>
        <SubmitButton pendingLabel="Saving…">Save working day</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function CleaningTeamForm({ team }: { team?: CleaningTeam }) {
  const router = useRouter();
  return (
    <ActionForm
      action={saveCleaningTeam}
      onSuccess={() => router.refresh()}
      resetOnSuccess={!team}
      className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)_auto] sm:items-end"
    >
      {team ? <input type="hidden" name="id" value={team.id} /> : null}
      <TextField label="Team name" name="name" defaultValue={team?.name ?? ""} placeholder="e.g. Sarah and Jo" required />
      <TextField
        label="Sets off from"
        name="home_postcode"
        defaultValue={team?.home_postcode ?? ""}
        placeholder="Postcode"
        className="uppercase"
        autoComplete="off"
      />
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pendingLabel="Saving…" variant={team ? "secondary" : "primary"}>
          {team ? "Save" : "Add team"}
        </SubmitButton>
        {team ? (
          <ActionButton
            action={archiveCleaningTeam.bind(null, team.id)}
            variant="quiet"
            icon={<Trash2 className="size-4" aria-hidden />}
            confirm={{
              title: `Remove ${team.name}?`,
              body: "Their upcoming cleans will be shared out between the other teams.",
              confirmLabel: "Remove team",
              danger: true,
            }}
          >
            <span className="sr-only">Remove {team.name}</span>
          </ActionButton>
        ) : null}
      </div>
      <div className="sm:col-span-3">
        <CheckboxField
          name="works_by_default"
          defaultChecked={team?.works_by_default ?? true}
          label="Usually works"
          description="Untick for a team that only helps on busy days. You can choose who's working on any day from the Cleaning plan page."
        />
      </div>
      <div className="sm:col-span-3">
        <FormError />
      </div>
    </ActionForm>
  );
}
