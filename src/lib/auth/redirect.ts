export type Role = "student" | "lecturer" | "admin";

const ROLE_PATHS: Record<Role, string> = {
  student: "/student",
  lecturer: "/lecturer",
  admin: "/admin",
};

export function getRedirectPathForRole(role: string | null): string {
  if (role && role in ROLE_PATHS) return ROLE_PATHS[role as Role];
  return "/login";
}
