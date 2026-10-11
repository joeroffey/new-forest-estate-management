"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!current) return { fieldErrors: { current: "Enter your current password" } };
  if (password.length < 8) return { fieldErrors: { password: "Use at least 8 characters" } };
  if (password.length > 72) return { fieldErrors: { password: "Use 72 characters or fewer" } };
  if (password !== confirm) return { fieldErrors: { confirm: "The passwords don't match" } };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Your session has ended. Please log in again." };

  const check = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (check.error) return { fieldErrors: { current: "That isn't your current password" } };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "We couldn't change your password. Please try again." };
  return { ok: true, message: "Password changed" };
}
