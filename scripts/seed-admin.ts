import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function seedAdmin(email: string, password: string, fullName: string) {
  const supabase = adminClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1000);

  const existingEmails = existing ? await Promise.all(
    existing.map(async (p) => (await supabase.auth.admin.getUserById(p.id)).data.user?.email)
  ) : [];
  if (existingEmails.includes(email)) {
    const { data } = await supabase.auth.admin.listUsers();
    const found = data.users.find((u) => u.email === email);
    return { id: found!.id };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role: "admin" },
  });

  if (error) throw error;
  return { id: data.user!.id };
}

async function main() {
  const [, , email, password, ...nameParts] = process.argv;
  if (!email || !password || nameParts.length === 0) {
    console.error("Usage: npm run seed:admin -- <email> <password> <full name>");
    process.exit(1);
  }
  const { id } = await seedAdmin(email, password, nameParts.join(" "));
  console.log(`Admin account ready: ${email} (id: ${id})`);
}

if (require.main === module) {
  main();
}
