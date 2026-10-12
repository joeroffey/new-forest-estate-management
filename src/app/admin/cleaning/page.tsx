import Link from "next/link";
import { AlertTriangle, CalendarCheck, Car, ChevronLeft, ChevronRight, Clock, MapPinned, Pin, RefreshCw, Send, Users, Zap } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDaysISO, formatDate, formatDayMonth, formatDuration, formatTimeFriendly, isValidISODate, plural, todayISO } from "@/lib/format";
import { getDayView, type DayStop } from "@/lib/cleaning/day";
import { addressForRoute } from "@/lib/cleaning/plan";
import { replanCleaningDay, sendCleaningPlanToWhatsApp } from "@/lib/cleaning/actions";
import { getSettings } from "@/lib/settings";
import { isWhatsAppConfigured } from "@/lib/integrations/whatsapp";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";
import { EmptyState } from "@/components/ui/empty-state";
import { MoveCleanSelect, WorkingTeamsForm } from "@/components/app/cleaning-plan";

export const metadata = { title: "Cleaning plan" };

const t = (value: string | null | undefined) => formatTimeFriendly(value?.slice(0, 5));

function StopItem({ stop, index, teams }: { stop: DayStop; index: number | null; teams: Array<{ id: string; name: string }> }) {
  const { job, property, booking } = stop;
  const late = job.late_minutes > 0;
  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 py-4 first:pt-0 last:pb-0">
      <span
        aria-hidden
        className={`mt-0.5 flex size-9 items-center justify-center rounded-full text-sm font-semibold ${late ? "bg-brick text-white" : "bg-forest text-white"}`}
      >
        {index ?? "–"}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink tabular-nums">
              {t(job.starts_at)} – {t(job.ends_at)}
              {index ? <span className="sr-only">: clean {index} of the run</span> : null}
            </p>
            <Link href={`/admin/bookings/${booking.id}`} className="text-[1.05rem] font-semibold text-forest-deep hover:underline">
              {property.name}
            </Link>
            <p className="text-sm text-ink-soft">{addressForRoute(property)}</p>
          </div>
          {teams.length > 1 ? (
            <MoveCleanSelect
              bookingId={booking.id}
              teams={teams}
              currentTeamId={job.team_id}
              pinnedTeamId={job.pinned_day === job.day ? job.pinned_team_id : null}
              label={`Which team cleans ${property.name}`}
            />
          ) : null}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Badge tone="outline" icon={<Clock className="size-3" aria-hidden />}>
            Out by {t(booking.checkout_time)}, clean {formatDuration(stop.cleanMinutes)}
          </Badge>
          {stop.deadline ? (
            <Badge tone="gorse" icon={<Zap className="size-3" aria-hidden />}>
              Next guests {t(stop.deadline)}
            </Badge>
          ) : null}
          {job.drive_minutes !== null && job.drive_from ? (
            <Badge tone="neutral" icon={<Car className="size-3" aria-hidden />}>
              {job.drive_minutes === 0 ? `Next door to ${job.drive_from}` : `${job.drive_minutes} min from ${job.drive_from}`}
            </Badge>
          ) : null}
          {job.pinned_team_id && job.pinned_day === job.day ? (
            <Badge tone="sage" icon={<Pin className="size-3" aria-hidden />}>
              Given to this team
            </Badge>
          ) : null}
        </div>
        {job.warning ? (
          <p className={`mt-2 flex items-start gap-1.5 text-sm ${late ? "font-semibold text-brick" : "text-gorse"}`}>
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {job.warning}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export default async function CleaningPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const today = todayISO();
  const day = params.date && isValidISODate(params.date) ? params.date : today;

  const admin = createAdminClient();
  const stripEnd = addDaysISO(today, 13);
  const [view, settings, { data: stripData }] = await Promise.all([
    getDayView(day),
    getSettings(),
    admin.from("bookings").select("departure_date").eq("status", "confirmed").gte("departure_date", today).lte("departure_date", stripEnd),
  ]);
  const counts = new Map<string, number>();
  for (const r of (stripData ?? []) as unknown as Array<{ departure_date: string }>) counts.set(r.departure_date, (counts.get(r.departure_date) ?? 0) + 1);
  const strip = Array.from({ length: 14 }, (_, i) => addDaysISO(today, i));

  const allStops = [...view.routes.flatMap((r) => r.stops), ...view.unassigned];
  const lateStops = allStops.filter((s) => s.job.late_minutes > 0);
  const teamOptions = view.working.map((x) => ({ id: x.id, name: x.name }));
  const totalDrive = view.routes.reduce((sum, r) => sum + r.driveMinutes, 0);
  const lastFinish = view.routes.map((r) => r.finish).filter((f): f is string => !!f).sort().at(-1) ?? null;
  const usedTeams = view.routes.filter((r) => r.stops.length).length;
  const whatsappReady = !!settings.whatsapp_chat_id && isWhatsAppConfigured(settings.whatsapp_provider);
  const link = (d: string) => `/admin/cleaning?date=${d}`;

  return (
    <>
      <PageHeader
        title="Cleaning plan"
        description={`${formatDate(day)}${day === today ? " (today)" : ""}. Each team's run is ordered so every house is ready before the next guests arrive, with as little driving as possible.`}
        actions={
          <>
            <div className="flex items-center gap-1">
              <Link href={link(addDaysISO(day, -1))} className={buttonClasses("secondary", "md", "px-2.5")} aria-label="Previous day">
                <ChevronLeft className="size-4" aria-hidden />
              </Link>
              <Link href={link(today)} className={buttonClasses("secondary", "md")}>
                Today
              </Link>
              <Link href={link(addDaysISO(day, 1))} className={buttonClasses("secondary", "md", "px-2.5")} aria-label="Next day">
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>
            <form action="/admin/cleaning" className="flex items-center gap-1">
              <label htmlFor="plan-date" className="sr-only">
                Go to a day
              </label>
              <input id="plan-date" type="date" name="date" defaultValue={day} className="rounded-lg border border-line bg-white px-3 py-2 text-sm" />
              <button type="submit" className={buttonClasses("secondary", "md")}>
                Go
              </button>
            </form>
          </>
        }
      />

      <nav aria-label="The next two weeks" className="-mx-1 mb-8 overflow-x-auto pb-1">
        <ul className="flex min-w-max gap-2 px-1">
          {strip.map((d) => {
            const n = counts.get(d) ?? 0;
            const active = d === day;
            return (
              <li key={d}>
                <Link
                  href={link(d)}
                  aria-current={active ? "date" : undefined}
                  className={`flex w-[5.5rem] flex-col rounded-xl border px-3 py-2 text-sm transition-colors ${
                    active ? "border-forest bg-forest text-white" : n ? "border-line bg-white hover:border-sage" : "border-line-soft bg-paper/60 text-ink-faint hover:border-line"
                  }`}
                >
                  <span className="font-semibold">{d === today ? "Today" : formatDayMonth(d).split(" ").slice(0, 2).join(" ")}</span>
                  <span className={active ? "text-mist" : n ? "text-ink-soft" : ""}>{n ? plural(n, "clean") : "None"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {view.teams.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" aria-hidden />}
          title="Add your cleaning teams"
          description="Add each team and the postcode they set off from. The planner then shares out each day's cleans and orders them for you."
          action={<ButtonLink href="/admin/settings#cleaning">Set up teams</ButtonLink>}
        />
      ) : null}

      {allStops.length === 0 ? (
        <EmptyState icon={<CalendarCheck className="size-8" aria-hidden />} title={`No changeovers on ${formatDayMonth(day)}`} description="Pick another day above." />
      ) : (
        <div className="grid gap-6">
          <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Cleans", String(allStops.length)],
              ["Teams out", `${usedTeams} of ${view.working.length}`],
              ["Driving", totalDrive ? `about ${formatDuration(totalDrive)}` : "–"],
              ["All done by", lastFinish ? t(lastFinish) : "–"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[var(--radius-card)] border border-line bg-white px-4 py-3">
                <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{label}</p>
                <p className="mt-1 font-serif text-2xl text-forest-deep">{value}</p>
              </div>
            ))}
          </section>

          {lateStops.length ? (
            <div role="alert" className="rounded-[var(--radius-card)] border border-brick/30 bg-brick-soft px-5 py-4 text-sm text-brick">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4" aria-hidden />
                {lateStops.length === 1 ? "One house won't be ready in time" : `${lateStops.length} houses won't be ready in time`}
              </p>
              <ul className="mt-1.5 list-disc pl-6">
                {lateStops.map((s) => (
                  <li key={s.job.booking_id}>
                    {s.property.name}: {s.job.warning}
                  </li>
                ))}
              </ul>
              <p className="mt-2">Add another team below, or move a clean to a team with more time.</p>
            </div>
          ) : null}

          {view.teams.length ? (
            <Panel>
              <WorkingTeamsForm
                key={`${day}-${view.working.map((w) => w.id).join(",")}`}
                day={day}
                teams={view.teams.map((x) => ({ id: x.id, name: x.name, works_by_default: x.works_by_default }))}
                workingIds={view.working.map((w) => w.id)}
                overridden={view.overridden}
              />
            </Panel>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-2">
            {view.routes.map((r) => (
              <div key={r.team.id} data-team={r.team.name} className="min-w-0">
              <Panel
                title={r.team.name}
                description={
                  r.stops.length
                    ? `${plural(r.stops.length, "clean")}${r.driveMinutes ? `, about ${formatDuration(r.driveMinutes)} driving` : ""}, done by ${t(r.finish)}`
                    : "Nothing planned: this team is free"
                }
                actions={
                  r.routeUrl ? (
                    <a href={r.routeUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "sm")}>
                      <MapPinned className="size-4" aria-hidden />
                      Route in Google Maps
                    </a>
                  ) : null
                }
              >
                {r.stops.length ? (
                  <ol className="divide-y divide-line-soft" aria-label={`${r.team.name}'s run`}>
                    {r.stops.map((s, i) => (
                      <StopItem key={s.job.booking_id} stop={s} index={i + 1} teams={teamOptions} />
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-ink-soft">
                    {r.team.home_postcode ? `Starts from ${r.team.home_postcode}.` : "No start postcode set, so the first drive isn't counted."}
                  </p>
                )}
              </Panel>
              </div>
            ))}
          </div>

          {view.unassigned.length ? (
            <Panel title="Not given to a team" description="No team is working this day. Tick a team above to plan these cleans.">
              <ol className="divide-y divide-line-soft">
                {view.unassigned.map((s) => (
                  <StopItem key={s.job.booking_id} stop={s} index={null} teams={teamOptions} />
                ))}
              </ol>
            </Panel>
          ) : null}

          <Panel
            title="Send to the cleaners"
            description={
              view.whatsappSentAt
                ? `Sent to WhatsApp on ${new Date(view.whatsappSentAt).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "numeric", minute: "2-digit" })}.`
                : settings.cleaning_plan_whatsapp && whatsappReady
                  ? "The plan is posted to the cleaners' WhatsApp group automatically each morning."
                  : "Send this day's plan to the cleaners' WhatsApp group."
            }
            actions={
              <>
                <ActionButton action={replanCleaningDay.bind(null, day)} size="sm" icon={<RefreshCw className="size-4" aria-hidden />}>
                  Re-plan
                </ActionButton>
                <ActionButton
                  action={sendCleaningPlanToWhatsApp.bind(null, day)}
                  size="sm"
                  variant="primary"
                  disabled={!whatsappReady}
                  icon={<Send className="size-4" aria-hidden />}
                  confirm={{
                    title: `Send the plan for ${formatDayMonth(day)}?`,
                    body: `Each team's run, times and route link will be posted to ${settings.whatsapp_chat_name ?? "the cleaners' WhatsApp group"}.`,
                    confirmLabel: "Send to WhatsApp",
                  }}
                >
                  Send to WhatsApp
                </ActionButton>
              </>
            }
          >
            <p className="text-sm text-ink-soft">
              Drive times are estimates from the distance between postcodes ({formatTimeFriendly(view.dayStart)} start, aiming to finish by {formatTimeFriendly(view.dayEnd)}). Change teams and working hours in{" "}
              <Link href="/admin/settings#cleaning" className="font-semibold text-forest underline-offset-2 hover:underline">
                Settings
              </Link>
              , and how long each house takes on its property page.
            </p>
            {!whatsappReady ? <p className="mt-2 text-sm text-gorse">WhatsApp isn&apos;t set up yet, so the plan can&apos;t be sent.</p> : null}
          </Panel>
        </div>
      )}
    </>
  );
}
