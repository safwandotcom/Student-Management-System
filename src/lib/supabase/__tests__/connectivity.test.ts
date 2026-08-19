// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

describe("local Supabase connectivity", () => {
  it("reaches the local auth server and gets an empty session", async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await supabase.auth.getSession();
    expect(error).toBeNull();
    expect(data.session).toBeNull();
  });
});
