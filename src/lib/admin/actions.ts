"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { updateProfileStatus } from "./status";

export async function setProfileStatus(
  profileId: string,
  status: "active" | "inactive",
  revalidateTo: string
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await updateProfileStatus(supabase, profileId, status);
  revalidatePath(revalidateTo);
}
