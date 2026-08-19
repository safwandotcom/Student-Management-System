import { getRedirectPathForRole, Role } from "./redirect";

export function resolveGuardRedirect(
  profile: { role: string; status?: string } | null,
  requiredRole: Role
): string | null {
  if (!profile) return "/login";
  if (profile.status && profile.status !== "active") return "/login";
  if (profile.role === requiredRole) return null;
  return getRedirectPathForRole(profile.role);
}
