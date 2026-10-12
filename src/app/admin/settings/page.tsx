import { CheckCircle2, CircleAlert, Mail, Send } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings, bankDetailsComplete } from "@/lib/settings";
import { getBaseUrl } from "@/lib/env";
import { isEmailConfigured } from "@/lib/email/send";
import { getWhatsAppStatus, isWhatsAppConfigured } from "@/lib/integrations/whatsapp";
import { isNotionConfigured } from "@/lib/integrations/notion";
import { sendTestEmail, sendTestWhatsApp, setNotionEnabled } from "@/lib/admin/settings";
import { formatDateShort } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { BusinessForm, InviteAdminForm, InvoicingForm, NotificationsForm, NotionForm, WhatsAppForm } from "@/components/app/settings-forms";
import { CleaningDayForm, CleaningTeamForm } from "@/components/app/cleaning-forms";
import type { CleaningTeam, Profile } from "@/lib/types";

export const metadata = { title: "Settings" };

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <p className={`flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-sm ${ok ? "bg-sage-soft/60 text-forest-deep" : "bg-gorse-soft text-gorse"}`}>
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <span>{children}</span>
    </p>
  );
}

export default async function SettingsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [s, { data: adminData }, baseUrl, { data: teamData }] = await Promise.all([
    getSettings(),
    supabase.from("profiles").select("*").eq("role", "admin").order("created_at"),
    getBaseUrl(),
    supabase.from("cleaning_teams").select("*").eq("archived", false).order("created_at"),
  ]);
  const admins = (adminData ?? []) as unknown as Profile[];
  const teams = (teamData ?? []) as unknown as CleaningTeam[];
  const configured = { greenapi: isWhatsAppConfigured("greenapi"), whapi: isWhatsAppConfigured("whapi") };
  const waStatus = configured[s.whatsapp_provider] ? await getWhatsAppStatus(s.whatsapp_provider) : null;
  const emailOk = isEmailConfigured();
  const notionOk = isNotionConfigured();

  const sections = [
    { id: "business", label: "Business" },
    { id: "invoicing", label: "Invoices and bank" },
    { id: "notifications", label: "Emails" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "notion", label: "Notion" },
    { id: "cleaning", label: "Cleaning teams" },
    { id: "team", label: "Team" },
  ];

  return (
    <>
      <PageHeader title="Settings" description="Business details, invoices, and the connections to email, WhatsApp and Notion." />
      <nav aria-label="Settings sections" className="mb-8 flex flex-wrap gap-2">
        {sections.map((sec) => (
          <a key={sec.id} href={`#${sec.id}`} className="rounded-full border border-line bg-white px-4 py-1.5 text-sm font-semibold text-ink-soft hover:text-forest-deep">
            {sec.label}
          </a>
        ))}
      </nav>

      <div className="grid gap-6">
        <Panel id="business" title="Business details" description="Used on invoices and emails." className="scroll-mt-6">
          <BusinessForm s={s} />
        </Panel>

        <Panel id="invoicing" title="Invoices and bank details" className="scroll-mt-6">
          {!bankDetailsComplete(s) ? <div className="mb-5"><Status ok={false}>Add your bank details so invoices show customers how to pay.</Status></div> : null}
          <InvoicingForm s={s} />
        </Panel>

        <Panel
          id="notifications"
          title="Emails"
          className="scroll-mt-6"
          actions={
            emailOk ? (
              <ActionButton action={sendTestEmail} size="sm" icon={<Mail className="size-4" aria-hidden />}>
                Send a test email
              </ActionButton>
            ) : null
          }
        >
          <div className="mb-5">
            <Status ok={emailOk}>
              {emailOk
                ? `Emails are sent through Resend from ${process.env.EMAIL_FROM}.`
                : "Emails aren't set up yet. Add RESEND_API_KEY and EMAIL_FROM in Vercel, then redeploy."}
            </Status>
          </div>
          <NotificationsForm s={s} />
        </Panel>

        <Panel
          id="whatsapp"
          title="WhatsApp"
          description="Post bookings to the cleaners' group automatically."
          className="scroll-mt-6"
          actions={
            s.whatsapp_chat_id && waStatus?.connected ? (
              <ActionButton action={sendTestWhatsApp} size="sm" icon={<Send className="size-4" aria-hidden />}>
                Send a test message
              </ActionButton>
            ) : null
          }
        >
          <div className="mb-5 space-y-2">
            {waStatus ? (
              <Status ok={waStatus.connected}>{waStatus.detail}</Status>
            ) : (
              <Status ok={false}>
                Not connected yet. Follow the WhatsApp steps in the setup guide, add the keys in Vercel, then come back here.
              </Status>
            )}
            {s.whatsapp_enabled && s.whatsapp_chat_name ? (
              <p className="text-sm text-ink-soft">
                Posting to <span className="font-semibold text-ink">{s.whatsapp_chat_name}</span>.
              </p>
            ) : null}
          </div>
          <WhatsAppForm s={s} configured={configured} />
        </Panel>

        <Panel
          id="notion"
          title="Notion calendar"
          description="Each booking becomes an entry in a Notion database, which shows in Notion Calendar."
          className="scroll-mt-6"
          actions={
            s.notion_database_id ? (
              <ActionButton action={setNotionEnabled.bind(null, !s.notion_enabled)} size="sm">
                {s.notion_enabled ? "Pause Notion sync" : "Turn Notion sync on"}
              </ActionButton>
            ) : null
          }
        >
          <div className="mb-5">
            {!notionOk ? (
              <Status ok={false}>Add NOTION_TOKEN in Vercel (see the setup guide), then redeploy.</Status>
            ) : s.notion_database_id ? (
              <Status ok={s.notion_enabled}>{s.notion_enabled ? "Connected. New and changed bookings appear in Notion." : "Connected, but sync is paused."}</Status>
            ) : (
              <Status ok={false}>Token added. Now connect your bookings database below.</Status>
            )}
          </div>
          <NotionForm s={s} />
        </Panel>

        <Panel
          id="cleaning"
          title="Cleaning teams"
          description="Each day's cleans are shared between the teams working and put in the best order: houses ready before the next guests arrive, with as little driving as possible."
          className="scroll-mt-6"
        >
          {teams.length === 0 ? (
            <div className="mb-5">
              <Status ok={false}>Add at least one team so the cleaning plan can be made.</Status>
            </div>
          ) : (
            <ul className="mb-6 space-y-4">
              {teams.map((team) => (
                <li key={team.id} className="rounded-xl border border-line p-4">
                  <CleaningTeamForm team={team} />
                  {team.home_postcode && team.located_from && team.lat === null ? (
                    <p className="mt-2 text-sm text-gorse">We couldn&apos;t find {team.home_postcode} on the map. Check the postcode.</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <h3 className="mb-3 text-sm font-semibold text-forest-deep">Add a team</h3>
          <CleaningTeamForm />
          <h3 className="mt-8 mb-3 border-t border-line-soft pt-6 text-sm font-semibold text-forest-deep">Working day</h3>
          <CleaningDayForm s={s} />
        </Panel>

        <Panel id="team" title="Team" description="People who can log in to this admin area." className="scroll-mt-6">
          <ul className="mb-6 divide-y divide-line-soft rounded-xl border border-line">
            {admins.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className="font-semibold">{a.full_name ?? "Admin"}</span> <span className="text-ink-soft">{a.email}</span>
                </span>
                <Badge tone="outline">Since {formatDateShort(a.created_at)}</Badge>
              </li>
            ))}
          </ul>
          <h3 className="mb-3 text-sm font-semibold text-forest-deep">Invite someone</h3>
          <InviteAdminForm />
        </Panel>

        <p className="text-xs text-ink-faint">Site address used in emails: {baseUrl}</p>
      </div>
    </>
  );
}
