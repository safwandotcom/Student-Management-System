import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export type InviteRole = "student" | "lecturer";

export async function inviteUser(
  email: string,
  fullName: string,
  role: InviteRole
): Promise<{ id: string }> {
  const supabase = adminClient();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be set to send invites.");
  }

  // Step 1: create the invited auth user. `data` here becomes user_metadata,
  // which is client-writable and must never carry authorization-relevant
  // fields — full_name is fine, role is not.
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${siteUrl}/accept-invite`,
  });
  if (error) throw new Error(error.message);

  const userId = data.user.id;

  // Step 2: set role via app_metadata (service-role-only-writable). This fires
  // the on_auth_user_app_metadata_updated trigger (Foundation phase), which
  // syncs profiles.role from raw_app_meta_data only — never from
  // raw_user_meta_data.
  const { error: metaError } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });
  if (metaError) throw new Error(metaError.message);

  return { id: userId };
}

export async function deleteInvitedUser(userId: string): Promise<void> {
  const supabase = adminClient();
  await supabase.auth.admin.deleteUser(userId);
}
