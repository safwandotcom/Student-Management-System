import { describe, it, expect } from "vitest";
import { isActiveLink } from "../nav";

describe("isActiveLink", () => {
  it("matches an exact path", () => {
    expect(isActiveLink("/student/courses", "/student/courses")).toBe(true);
  });

  it("matches a nested path under the link", () => {
    expect(isActiveLink("/student/courses/123", "/student/courses")).toBe(true);
  });

  it("does not match a sibling path", () => {
    expect(isActiveLink("/student/attendance", "/student/courses")).toBe(false);
  });

  it("does not match a different root by prefix accident", () => {
    expect(isActiveLink("/student/coursework", "/student/courses")).toBe(false);
  });
});
