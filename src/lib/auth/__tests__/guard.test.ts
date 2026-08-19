import { describe, it, expect } from "vitest";
import { resolveGuardRedirect } from "../guard";

describe("resolveGuardRedirect", () => {
  it("sends signed-out users to /login", () => {
    expect(resolveGuardRedirect(null, "student")).toBe("/login");
  });

  it("allows access when the role matches", () => {
    expect(resolveGuardRedirect({ role: "student" }, "student")).toBeNull();
  });

  it("redirects a mismatched role to their own portal", () => {
    expect(resolveGuardRedirect({ role: "lecturer" }, "student")).toBe("/lecturer");
  });

  it("redirects an unrecognized role to /login", () => {
    expect(resolveGuardRedirect({ role: "bogus" }, "student")).toBe("/login");
  });

  it("redirects an inactive profile to /login even if the role matches", () => {
    expect(resolveGuardRedirect({ role: "student", status: "inactive" }, "student")).toBe("/login");
  });
});
