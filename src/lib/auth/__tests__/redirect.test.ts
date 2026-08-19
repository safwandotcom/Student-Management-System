import { describe, it, expect } from "vitest";
import { getRedirectPathForRole } from "../redirect";

describe("getRedirectPathForRole", () => {
  it("sends students to /student", () => {
    expect(getRedirectPathForRole("student")).toBe("/student");
  });
  it("sends lecturers to /lecturer", () => {
    expect(getRedirectPathForRole("lecturer")).toBe("/lecturer");
  });
  it("sends admins to /admin", () => {
    expect(getRedirectPathForRole("admin")).toBe("/admin");
  });
  it("sends unknown/missing roles to /login", () => {
    expect(getRedirectPathForRole(null)).toBe("/login");
    expect(getRedirectPathForRole("bogus")).toBe("/login");
  });
});
