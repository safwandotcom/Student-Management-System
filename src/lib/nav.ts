export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

export function isActiveLink(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(href + "/");
}
