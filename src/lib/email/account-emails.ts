import { site } from "@/lib/site";
import {
  bulletList,
  button,
  greeting,
  link,
  linkFallback,
  notice,
  paragraph,
  rawParagraph,
  renderEmail,
  signOff,
  smallPrint,
  type RenderedEmail,
} from "@/lib/email/templates";

/*
 * Account emails: owner invitations, admin invitations and the first-time setup link,
 * "you already have an account", and password resets.
 */

const OWNER_FOOTNOTE = `You're receiving this because an owner account with ${site.name} uses this email address.`;

/** Sent to an owner when we set up their portal account (or they ask for one on /register). */
export function customerInviteEmail(opts: { baseUrl: string; fullName: string; url: string; validDays: number }): RenderedEmail {
  const register = `${opts.baseUrl}/register`;
  const email = renderEmail({
    eyebrow: "Owner account",
    title: "Your owner account is ready",
    preheader: "Choose a password to send us bookings and see your invoices online.",
    baseUrl: opts.baseUrl,
    blocks: [
      greeting(opts.fullName),
      paragraph(`We've set up an online owner account for you with ${site.name}. Once you've chosen a password, you can:`),
      bulletList([
        "Send us your guest bookings, a whole season at a time if you like",
        "Check upcoming changeovers and make changes",
        "See and download every invoice",
      ]),
      button("Set up my account", opts.url),
      linkFallback(opts.url),
      smallPrint(
        `This link works for ${opts.validDays} days and can only be used once. If it runs out, ask for a new one here: ${register}`,
        `This link works for ${opts.validDays} days and can only be used once. If it runs out, ${link("ask for a new one", register)}.`,
      ),
      smallPrint("If you weren't expecting this email, you can safely ignore it."),
      signOff(),
    ],
    footerNote: `You're receiving this because an owner account was set up for this email address with ${site.name}.`,
  });
  return { subject: `Set up your ${site.name} account`, ...email };
}

/** Sent to a team member given admin access, or to the owner of the site for first-time setup. */
export function adminInviteEmail(opts: {
  baseUrl: string;
  fullName: string;
  url: string;
  validDays: number;
  /** First-time setup from the /setup page, rather than an invitation from another admin. */
  setup: boolean;
  invitedBy: string;
}): RenderedEmail {
  const email = renderEmail({
    eyebrow: "Admin access",
    title: opts.setup ? "Finish setting up your admin login" : "You've been added as an administrator",
    preheader: opts.setup
      ? "Choose a password to open the admin area of your website."
      : `${opts.invitedBy} has given you access to the ${site.name} admin area.`,
    baseUrl: opts.baseUrl,
    blocks: [
      greeting(opts.fullName),
      paragraph(
        opts.setup
          ? `Use the button below to choose your password and open the ${site.name} admin area. From there you can manage customers, bookings, the cleaning plan and invoices.`
          : `${opts.invitedBy} has given you access to the ${site.name} admin area, where you can manage customers, bookings, the cleaning plan and invoices.`,
      ),
      button("Choose my password", opts.url),
      linkFallback(opts.url),
      smallPrint(`This link works for ${opts.validDays} days and can only be used once.`),
      smallPrint(
        opts.setup ? "If you didn't ask for this, you can ignore this email." : "If you weren't expecting this, you can ignore this email and nothing will change.",
      ),
    ],
    footerNote: `You're receiving this because this email address was given admin access to the ${site.name} website.`,
  });
  return {
    subject: opts.setup ? `Set up your ${site.name} admin login` : `Your ${site.name} admin login`,
    ...email,
  };
}

/** Sent when someone asks for an account on /register for an owner who already has one. */
export function existingAccountEmail(opts: { baseUrl: string; fullName: string }): RenderedEmail {
  const reset = `${opts.baseUrl}/forgot-password`;
  const email = renderEmail({
    eyebrow: "Owner account",
    title: "You already have an account",
    preheader: "Log in to your owner account, or choose a new password if you've forgotten it.",
    baseUrl: opts.baseUrl,
    blocks: [
      greeting(opts.fullName),
      paragraph(`Someone asked to set up an owner account for this email address, but you already have one with ${site.name}, so there's nothing new to set up.`),
      button("Log in", `${opts.baseUrl}/login`),
      rawParagraph(
        `Forgotten your password? ${link("Choose a new one", reset)} and we'll email you a link.`,
        `Forgotten your password? Choose a new one here:\n${reset}`,
      ),
      smallPrint("If this wasn't you, you can ignore this email. Your account hasn't changed."),
      signOff(),
    ],
    footerNote: OWNER_FOOTNOTE,
  });
  return { subject: `You already have a ${site.name} account`, ...email };
}

/** The link to choose a new password, from the "Forgotten your password?" page. */
export function passwordResetEmail(opts: { baseUrl: string; url: string }): RenderedEmail {
  const email = renderEmail({
    eyebrow: "Your account",
    title: "Reset your password",
    preheader: "Use this link within the next hour to choose a new password.",
    baseUrl: opts.baseUrl,
    blocks: [
      greeting(),
      paragraph(`We received a request to reset the password for your ${site.name} account. Use the button below to choose a new one.`),
      button("Choose a new password", opts.url),
      linkFallback(opts.url),
      notice({
        tone: "sage",
        title: "This link expires in one hour.",
        body: "It can only be used once. If it has expired, ask for a new one from the login page.",
      }),
      smallPrint("If you didn't ask for this, you can ignore this email. Your password won't change."),
      signOff(),
    ],
    footerNote: "You're receiving this because a password reset was requested for this email address on our website.",
  });
  return { subject: `Reset your ${site.name} password`, ...email };
}
