# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the shared foundation every portal depends on: scaffolded Next.js + Supabase app, design system primitives, auth with role-based routing, RLS-protected `profiles` schema, and a seeded first Admin account — demoable as "log in as Admin, see the Admin shell."

**Architecture:** One Next.js (App Router, TypeScript) app using Tailwind CSS for styling, backed by one Supabase project (local, via Docker, for this phase) for Postgres + Auth. `@supabase/ssr` handles session cookies across server components, server actions, and middleware. Role is read from a `profiles` table row (one row per `auth.users` row, created by a DB trigger) and used to route users to `/student`, `/lecturer`, or `/admin`.

**Tech Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth) via `@supabase/supabase-js` + `@supabase/ssr` · Supabase CLI (local dev, requires Docker Desktop running) · Vitest + React Testing Library for tests.

**Spec:** `docs/superpowers/specs/2026-08-19-student-management-system-design.md`

## Global Constraints

- One Next.js app (TypeScript, App Router, Tailwind CSS), one Supabase project (Postgres + Auth + Storage), one login page — per spec "Architecture".
- Accounts are admin-provisioned only; no public self-registration — per spec "Accounts & Auth".
- Row Level Security enforces per-role visibility: students see only their own records; lecturers see only their assigned course offerings; admins see everything — per spec "Accounts & Auth".
- Visual identity must be original — do not reuse FBS DU's indigo/maroon branding — per spec "Purpose".
- Package manager: npm. Local dev backend: Supabase CLI + Docker (Docker Desktop must be running before Task 4 onward).

---

## Prerequisites (manual, before Task 1)

These are account/credential steps only you can do — Claude cannot create accounts or handle passwords on your behalf:

1. Install/open **Docker Desktop** and make sure it's running (`docker info` should show a `Server:` section without errors). The Supabase CLI needs it for local Postgres.
2. Nothing else is required yet — no cloud Supabase account is needed for this phase; we develop against a local Supabase stack. Cloud project creation happens later, when you're ready to deploy.

---

### Task 1: Scaffold the Next.js app + test harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Test: `src/lib/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: an `npm run dev` app, an `npm test` command (Vitest), and the `src/` directory convention (`src/app`, `src/components`, `src/lib`) every later task builds inside.

- [ ] **Step 1: Scaffold with create-next-app**

Run (this directory already has `.git` and `docs/`, which `create-next-app` tolerates):

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-git
```

If it warns about non-empty directory and refuses, confirm it's only complaining about `.git`/`docs` and proceed with `--yes` or re-run with the same flags — it only object to conflicting files, and there are none.

- [ ] **Step 2: Verify the dev server boots**

Run: `npm run build`
Expected: build completes with no errors (default starter page compiles).

- [ ] **Step 3: Install test tooling**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

Create `vitest.setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

Add to `package.json` `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Write a smoke test**

Create `src/lib/__tests__/smoke.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("test harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run the test suite**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest test harness

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Design tokens + base UI primitives (Button, Badge, Card)

**Files:**
- Modify: `tailwind.config.ts`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/ui/Card.tsx`
- Test: `src/components/ui/__tests__/Button.test.tsx`
- Test: `src/components/ui/__tests__/Badge.test.tsx`

**Interfaces:**
- Consumes: nothing outside this task.
- Produces: `<Button variant="primary"|"secondary"|"ghost" size="sm"|"md">`, `<Badge tone="success"|"warning"|"danger"|"neutral"|"info">`, `<Card>` — every later portal screen (Tasks 8, 10, and every future phase) is built from these.

- [ ] **Step 1: Extend Tailwind theme with the system's color tokens**

Edit `tailwind.config.ts`, add under `theme.extend.colors` (original palette — not FBS DU's indigo/maroon):

```typescript
colors: {
  brand: {
    50: "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 300: "#5eead4",
    400: "#2dd4bf", 500: "#14b8a6", 600: "#0d9488", 700: "#0f766e",
    800: "#115e59", 900: "#134e4a",
  },
  ink: {
    50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1",
    400: "#94a3b8", 500: "#64748b", 600: "#475569", 700: "#334155",
    800: "#1e293b", 900: "#0f172a",
  },
  success: { 100: "#dcfce7", 700: "#15803d" },
  warning: { 100: "#fef3c7", 700: "#b45309" },
  danger:  { 100: "#fee2e2", 700: "#b91c1c" },
  info:    { 100: "#dbeafe", 700: "#1d4ed8" },
},
```

- [ ] **Step 2: Write the failing Button test**

Create `src/components/ui/__tests__/Button.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Button } from "../Button";

describe("Button", () => {
  it("renders children and applies the primary variant class", () => {
    render(<Button variant="primary">Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toHaveClass("bg-brand-700");
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("disables the button when loading", () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- Button`
Expected: FAIL — `../Button` module not found.

- [ ] **Step 4: Implement Button**

Create `src/components/ui/Button.tsx`:

```tsx
import { ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800",
  secondary: "bg-ink-100 text-ink-800 hover:bg-ink-200",
  ghost: "bg-transparent text-ink-700 hover:bg-ink-100",
  danger: "bg-danger-700 text-white hover:bg-red-800",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, className, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading ? "Loading…" : children}
    </button>
  )
);
Button.displayName = "Button";
```

Install `clsx`: `npm install clsx`

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- Button`
Expected: PASS (3 tests).

- [ ] **Step 6: Write the failing Badge test**

Create `src/components/ui/__tests__/Badge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "../Badge";

describe("Badge", () => {
  it("renders its label with the tone's class", () => {
    render(<Badge tone="success">Completed</Badge>);
    const badge = screen.getByText("Completed");
    expect(badge).toHaveClass("bg-success-100", "text-success-700");
  });

  it("defaults to the neutral tone", () => {
    render(<Badge>Pending</Badge>);
    expect(screen.getByText("Pending")).toHaveClass("bg-ink-100");
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- Badge`
Expected: FAIL — `../Badge` module not found.

- [ ] **Step 8: Implement Badge**

Create `src/components/ui/Badge.tsx`:

```tsx
import { HTMLAttributes } from "react";
import { clsx } from "clsx";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  success: "bg-success-100 text-success-700",
  warning: "bg-warning-100 text-warning-700",
  danger: "bg-danger-100 text-danger-700",
  info: "bg-info-100 text-info-700",
  neutral: "bg-ink-100 text-ink-700",
};

export function Badge({ tone = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- Badge`
Expected: PASS (2 tests).

- [ ] **Step 10: Implement Card (no test — pure layout wrapper, verified visually in Task 3/8)**

Create `src/components/ui/Card.tsx`:

```tsx
import { HTMLAttributes } from "react";
import { clsx } from "clsx";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("rounded-xl border border-ink-200 bg-white p-6 shadow-sm", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("mb-4", className)} {...props}>
      {children}
    </div>
  );
}
```

- [ ] **Step 11: Run full suite and commit**

Run: `npm test`
Expected: all passing.

```bash
git add -A
git commit -m "feat: add design tokens and Button/Badge/Card UI primitives

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Sidebar shell layout

**Files:**
- Create: `src/components/shell/Sidebar.tsx`
- Create: `src/components/shell/PortalShell.tsx`
- Create: `src/lib/nav.ts`
- Test: `src/lib/__tests__/nav.test.ts`

**Interfaces:**
- Consumes: `Button`, `Badge` from Task 2 (not required here, but same `clsx` pattern).
- Produces: `isActiveLink(pathname: string, href: string): boolean` (used by `Sidebar`), `<PortalShell navItems={NavItem[]} roleLabel={string} userLabel={string}>` — Task 8's role-guard layouts wrap their pages in this.

- [ ] **Step 1: Write the failing test for the active-link logic**

Create `src/lib/__tests__/nav.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- nav`
Expected: FAIL — `../nav` module not found.

- [ ] **Step 3: Implement `isActiveLink` and the `NavItem` type**

Create `src/lib/nav.ts`:

```typescript
export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

export function isActiveLink(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(href + "/");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- nav`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement Sidebar**

Create `src/components/shell/Sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { NavItem, isActiveLink } from "@/lib/nav";

export function Sidebar({ items, roleLabel }: { items: NavItem[]; roleLabel: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-60 flex-col border-r border-ink-200 bg-ink-900 text-ink-100">
      <div className="border-b border-ink-800 px-5 py-4">
        <p className="text-sm font-semibold text-white">Campus</p>
        <p className="text-xs text-ink-400">{roleLabel}</p>
      </div>
      <ul className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = isActiveLink(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-brand-700 text-white" : "text-ink-300 hover:bg-ink-800 hover:text-white"
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 6: Implement PortalShell**

Create `src/components/shell/PortalShell.tsx`:

```tsx
import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { NavItem } from "@/lib/nav";

export function PortalShell({
  navItems,
  roleLabel,
  userLabel,
  children,
}: {
  navItems: NavItem[];
  roleLabel: string;
  userLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-ink-50">
      <Sidebar items={navItems} roleLabel={roleLabel} />
      <div className="flex-1">
        <header className="flex items-center justify-end border-b border-ink-200 bg-white px-6 py-3">
          <span className="text-sm text-ink-600">{userLabel}</span>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run full suite and commit**

Run: `npm test`
Expected: all passing.

```bash
git add -A
git commit -m "feat: add Sidebar and PortalShell layout components

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Local Supabase project + JS clients

**Files:**
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `.env.local` (gitignored), `.env.local.example`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Test: `src/lib/supabase/__tests__/connectivity.test.ts`

**Interfaces:**
- Produces: `createBrowserSupabaseClient()` (client components), `createServerSupabaseClient()` (server components/actions/route handlers) — every task from here on that touches Supabase imports one of these two.

- [ ] **Step 1: Confirm Docker is running**

Run: `docker info`
Expected: a `Server:` section with no connection error. If it errors, start Docker Desktop and retry before continuing.

- [ ] **Step 2: Install Supabase client libraries**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D supabase
```

- [ ] **Step 3: Initialize and start the local Supabase stack**

```bash
npx supabase init
npx supabase start
```

Expected: after image downloads, it prints a table including `API URL`, `anon key`, and `service_role key` for `http://127.0.0.1:54321`.

- [ ] **Step 4: Record local credentials**

Create `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Create `.env.local` (copy the values `supabase start` printed in Step 3 — do not commit this file):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start output>
```

Confirm `.gitignore` already contains `.env*.local` (create-next-app adds this by default) — if not, add it.

- [ ] **Step 5: Implement the browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 6: Implement the server client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component with no request context — safe to ignore,
            // middleware (Task 7) refreshes the session on every request instead.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 7: Write the failing connectivity test**

Create `src/lib/supabase/__tests__/connectivity.test.ts`:

```typescript
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
```

Update `vitest.config.ts` `test` block to load env vars:

```typescript
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
```

Install dotenv loader for tests: `npm install -D dotenv-cli`, and change the `test` script to:
`"test": "dotenv -e .env.local -- vitest run"`

- [ ] **Step 8: Run test to verify it fails**

Run: `npm test -- connectivity`
Expected: FAIL before Step 3/4 are done, or PASS if already done — if it fails with a network error here, re-check `.env.local` values against `supabase start` output.

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- connectivity`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: wire up local Supabase project and JS clients

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(`.env.local` is gitignored and will not be committed — that's correct.)

---

### Task 5: `profiles` schema + auto-create trigger

**Files:**
- Create: `supabase/migrations/00000000000001_profiles.sql`
- Test: `src/lib/supabase/__tests__/profiles.test.ts`

**Interfaces:**
- Produces: `public.profiles` table `(id uuid pk references auth.users, full_name text, role text check in ('student','lecturer','admin'), status text default 'active', avatar_url text, phone text, created_at timestamptz)`, auto-populated on `auth.users` insert via trigger `on_auth_user_created`. Role/full_name are read from the new user's `raw_user_meta_data` (set at creation time by the invite flow in a later phase, or directly by the seed script in Task 9).

- [ ] **Step 1: Write the failing test**

Create `src/lib/supabase/__tests__/profiles.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

describe("profiles auto-create trigger", () => {
  let createdUserId: string;

  it("creates a matching profile row when a new auth user is created", async () => {
    const email = `trigger-test-${Date.now()}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { full_name: "Trigger Test", role: "student" },
    });
    expect(error).toBeNull();
    createdUserId = data.user!.id;

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("*")
      .eq("id", createdUserId)
      .single();

    expect(profileError).toBeNull();
    expect(profile).toMatchObject({
      id: createdUserId,
      full_name: "Trigger Test",
      role: "student",
      status: "active",
    });
  });

  afterAll(async () => {
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- profiles`
Expected: FAIL — `relation "public.profiles" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/00000000000001_profiles.sql`:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('student', 'lecturer', 'admin')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  avatar_url text,
  phone text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 4: Apply the migration to the local stack**

Run: `npx supabase migration up`
Expected: applies `00000000000001_profiles.sql` with no errors.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- profiles`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add profiles table with auto-create trigger on signup

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Row Level Security on `profiles`

**Files:**
- Create: `supabase/migrations/00000000000002_profiles_rls.sql`
- Test: `src/lib/supabase/__tests__/profiles-rls.test.ts`

**Interfaces:**
- Consumes: `public.profiles` from Task 5.
- Produces: RLS policies enforcing "own row, or admin sees all" — the pattern every later table's RLS (courses, grades, payments, etc. in future phases) follows.

- [ ] **Step 1: Write the failing test**

Create `src/lib/supabase/__tests__/profiles-rls.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe("profiles RLS", () => {
  let studentAId: string, studentBId: string, adminId: string;
  const password = "TestPassword123!";
  let studentAEmail: string, studentBEmail: string, adminEmail: string;

  beforeAll(async () => {
    const stamp = Date.now();
    studentAEmail = `rls-a-${stamp}@example.com`;
    studentBEmail = `rls-b-${stamp}@example.com`;
    adminEmail = `rls-admin-${stamp}@example.com`;

    const a = await admin.auth.admin.createUser({
      email: studentAEmail, password, email_confirm: true,
      user_metadata: { full_name: "Student A", role: "student" },
    });
    const b = await admin.auth.admin.createUser({
      email: studentBEmail, password, email_confirm: true,
      user_metadata: { full_name: "Student B", role: "student" },
    });
    const adm = await admin.auth.admin.createUser({
      email: adminEmail, password, email_confirm: true,
      user_metadata: { full_name: "Admin One", role: "admin" },
    });
    studentAId = a.data.user!.id;
    studentBId = b.data.user!.id;
    adminId = adm.data.user!.id;
  });

  it("lets a student read their own profile but not another student's", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: studentAEmail, password });

    const own = await client.from("profiles").select("*").eq("id", studentAId).single();
    expect(own.error).toBeNull();
    expect(own.data?.id).toBe(studentAId);

    const other = await client.from("profiles").select("*").eq("id", studentBId).maybeSingle();
    expect(other.data).toBeNull();
  });

  it("lets an admin read every profile", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: adminEmail, password });

    const { data, error } = await client
      .from("profiles")
      .select("*")
      .in("id", [studentAId, studentBId, adminId]);

    expect(error).toBeNull();
    expect(data).toHaveLength(3);
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(studentAId);
    await admin.auth.admin.deleteUser(studentBId);
    await admin.auth.admin.deleteUser(adminId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- profiles-rls`
Expected: FAIL — with RLS not yet enabled, Student A can also read Student B's row (the "not another student's" assertion fails).

- [ ] **Step 3: Write the RLS migration**

Create `supabase/migrations/00000000000002_profiles_rls.sql`:

```sql
alter table public.profiles enable row level security;

create function public.current_user_role()
returns text
language sql
security definer set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create policy "profiles: read own row"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: admin reads all"
  on public.profiles for select
  using (public.current_user_role() = 'admin');

create policy "profiles: admin updates all"
  on public.profiles for update
  using (public.current_user_role() = 'admin');
```

- [ ] **Step 4: Apply the migration**

Run: `npx supabase migration up`
Expected: applies with no errors.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- profiles-rls`
Expected: PASS.

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test`
Expected: all passing.

```bash
git add -A
git commit -m "feat: enforce row level security on profiles

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Login page, auth actions, and session-refresh middleware

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/login/actions.ts`
- Create: `src/lib/auth/redirect.ts`
- Create: `src/middleware.ts`
- Test: `src/lib/auth/__tests__/redirect.test.ts`

**Interfaces:**
- Consumes: `createBrowserSupabaseClient`/`createServerSupabaseClient` from Task 4, `Button` from Task 2.
- Produces: `getRedirectPathForRole(role: string | null): string` — Task 8's layouts and the root page (Task 10) use this to send a signed-in user to the right portal.

- [ ] **Step 1: Write the failing test**

Create `src/lib/auth/__tests__/redirect.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- redirect`
Expected: FAIL — `../redirect` module not found.

- [ ] **Step 3: Implement `getRedirectPathForRole`**

Create `src/lib/auth/redirect.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- redirect`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement the sign-in server action**

Create `src/app/login/actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRedirectPathForRole } from "@/lib/auth/redirect";

export async function signIn(_prevState: { error: string | null }, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "Incorrect email or password." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  redirect(getRedirectPathForRole(profile?.role ?? null));
}
```

- [ ] **Step 6: Implement the login page**

Create `src/app/login/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { signIn } from "./actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, { error: null });

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-lg font-semibold text-ink-900">Sign in</h1>
        <p className="mb-6 text-sm text-ink-500">Use the account your administrator gave you.</p>
        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink-700">Email</label>
            <input
              id="email" name="email" type="email" required
              className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink-700">Password</label>
            <input
              id="password" name="password" type="password" required
              className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
            />
          </div>
          {state.error && <p className="text-sm text-danger-700">{state.error}</p>}
          <Button type="submit" loading={pending} className="w-full">Sign in</Button>
        </form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 7: Implement session-refresh middleware**

Create `src/middleware.ts` (Next.js reads `middleware.ts` from inside `src/` when the project uses the `--src-dir` layout):

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 8: Run full suite and commit**

Run: `npm test`
Expected: all passing.

```bash
git add -A
git commit -m "feat: add login page, sign-in action, and session middleware

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Role-guard layouts for `/student`, `/lecturer`, `/admin`

**Files:**
- Create: `src/lib/auth/guard.ts`
- Create: `src/app/student/layout.tsx`
- Create: `src/app/lecturer/layout.tsx`
- Create: `src/app/admin/layout.tsx`
- Test: `src/lib/auth/__tests__/guard.test.ts`

**Interfaces:**
- Consumes: `getRedirectPathForRole` is not reused directly here — this task defines the sibling function for the "already signed in, wrong portal" case.
- Produces: `resolveGuardRedirect(profile: { role: string } | null, requiredRole: Role): string | null` — returns the path to redirect to, or `null` if access is allowed. Future phases' role-specific pages sit inside these three layouts and inherit the guard for free.

- [ ] **Step 1: Write the failing test**

Create `src/lib/auth/__tests__/guard.test.ts`:

```typescript
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- guard`
Expected: FAIL — `../guard` module not found.

- [ ] **Step 3: Implement `resolveGuardRedirect`**

Create `src/lib/auth/guard.ts`:

```typescript
import { getRedirectPathForRole, Role } from "./redirect";

export function resolveGuardRedirect(
  profile: { role: string } | null,
  requiredRole: Role
): string | null {
  if (!profile) return "/login";
  if (profile.role === requiredRole) return null;
  return getRedirectPathForRole(profile.role);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- guard`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement the Student layout**

Create `src/app/student/layout.tsx`:

```tsx
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveGuardRedirect } from "@/lib/auth/guard";
import { PortalShell } from "@/components/shell/PortalShell";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/student" },
  { label: "My Courses", href: "/student/courses" },
  { label: "Attendance", href: "/student/attendance" },
  { label: "Results", href: "/student/results" },
  { label: "Fees & Payments", href: "/student/payments" },
  { label: "Profile", href: "/student/profile" },
  { label: "Support Tickets", href: "/student/tickets" },
];

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: { role: string; full_name: string } | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
    profile = data;
  }

  const redirectTo = resolveGuardRedirect(profile, "student");
  if (redirectTo) redirect(redirectTo);

  return (
    <PortalShell navItems={NAV_ITEMS} roleLabel="Student Portal" userLabel={profile!.full_name}>
      {children}
    </PortalShell>
  );
}
```

- [ ] **Step 6: Implement the Lecturer layout**

Create `src/app/lecturer/layout.tsx` (same shape as Step 5, swap in lecturer nav):

```tsx
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveGuardRedirect } from "@/lib/auth/guard";
import { PortalShell } from "@/components/shell/PortalShell";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/lecturer" },
  { label: "My Courses", href: "/lecturer/courses" },
  { label: "Attendance", href: "/lecturer/attendance" },
  { label: "Gradebook", href: "/lecturer/grades" },
  { label: "Notices", href: "/lecturer/notices" },
  { label: "Support Tickets", href: "/lecturer/tickets" },
];

export default async function LecturerLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: { role: string; full_name: string } | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
    profile = data;
  }

  const redirectTo = resolveGuardRedirect(profile, "lecturer");
  if (redirectTo) redirect(redirectTo);

  return (
    <PortalShell navItems={NAV_ITEMS} roleLabel="Lecturer Portal" userLabel={profile!.full_name}>
      {children}
    </PortalShell>
  );
}
```

- [ ] **Step 7: Implement the Admin layout**

Create `src/app/admin/layout.tsx` (same shape, admin nav):

```tsx
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveGuardRedirect } from "@/lib/auth/guard";
import { PortalShell } from "@/components/shell/PortalShell";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin" },
  { label: "Students", href: "/admin/students" },
  { label: "Lecturers", href: "/admin/lecturers" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Fees & Payments", href: "/admin/payments" },
  { label: "Notices", href: "/admin/notices" },
  { label: "Support Tickets", href: "/admin/tickets" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: { role: string; full_name: string } | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
    profile = data;
  }

  const redirectTo = resolveGuardRedirect(profile, "admin");
  if (redirectTo) redirect(redirectTo);

  return (
    <PortalShell navItems={NAV_ITEMS} roleLabel="Admin Portal" userLabel={profile!.full_name}>
      {children}
    </PortalShell>
  );
}
```

- [ ] **Step 8: Run full suite and commit**

Run: `npm test`
Expected: all passing.

```bash
git add -A
git commit -m "feat: add role-guard layouts for student/lecturer/admin portals

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Seed script for the first Admin account

**Files:**
- Create: `scripts/seed-admin.ts`
- Test: `scripts/__tests__/seed-admin.test.ts`

**Interfaces:**
- Consumes: `SUPABASE_SERVICE_ROLE_KEY` env var (Task 4), triggers Task 5's `handle_new_user`.
- Produces: `seedAdmin(email: string, password: string, fullName: string): Promise<{ id: string }>` — an idempotent function the `npm run seed:admin` CLI wraps; later phases' "Admin invites a Lecturer/Student" feature reuses the same `admin.auth.admin.createUser` pattern.

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/seed-admin.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { seedAdmin } from "../seed-admin";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

describe("seedAdmin", () => {
  const email = `seed-admin-test-${Date.now()}@example.com`;
  let userId: string;

  it("creates a user with an admin profile", async () => {
    const result = await seedAdmin(email, "TestPassword123!", "Seed Admin");
    userId = result.id;

    const { data: profile } = await admin.from("profiles").select("*").eq("id", userId).single();
    expect(profile).toMatchObject({ full_name: "Seed Admin", role: "admin" });
  });

  it("is idempotent: calling it again with the same email does not error", async () => {
    await expect(seedAdmin(email, "TestPassword123!", "Seed Admin")).resolves.toBeDefined();
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- seed-admin`
Expected: FAIL — `../seed-admin` module not found.

- [ ] **Step 3: Implement `seedAdmin`**

Create `scripts/seed-admin.ts`:

```typescript
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
    user_metadata: { full_name: fullName, role: "admin" },
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
```

Add to `package.json` `"scripts"`:

```json
"seed:admin": "dotenv -e .env.local -- tsx scripts/seed-admin.ts"
```

Install `tsx`: `npm install -D tsx`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- seed-admin`
Expected: PASS (2 tests).

- [ ] **Step 5: Actually seed your own first Admin account**

Run (replace with a real email/password you'll remember):

```bash
npm run seed:admin -- you@example.com "ChooseAStrongPassword1!" "Your Name"
```

Expected: prints `Admin account ready: ...`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add idempotent admin seed script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Root redirect + placeholder dashboards (end-to-end demo)

**Files:**
- Create: `src/app/page.tsx` (overwrite the starter page)
- Create: `src/app/student/page.tsx`
- Create: `src/app/lecturer/page.tsx`
- Create: `src/app/admin/page.tsx`
- Test: manual verification only (this task wires together already-tested pieces; see Step-by-step verification below)

**Interfaces:**
- Consumes: `createServerSupabaseClient` (Task 4), `getRedirectPathForRole` (Task 7), `Card` (Task 2). No new exports — this is the phase's integration point.

- [ ] **Step 1: Implement the root page**

Overwrite `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRedirectPathForRole } from "@/lib/auth/redirect";

export default async function RootPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  redirect(getRedirectPathForRole(profile?.role ?? null));
}
```

- [ ] **Step 2: Implement the Student placeholder dashboard**

Create `src/app/student/page.tsx`:

```tsx
import { Card } from "@/components/ui/Card";

export default function StudentDashboard() {
  return (
    <Card>
      <h1 className="text-lg font-semibold text-ink-900">Welcome to your Student Dashboard</h1>
      <p className="mt-1 text-sm text-ink-500">
        Courses, attendance, results, and payments will appear here.
      </p>
    </Card>
  );
}
```

- [ ] **Step 3: Implement the Lecturer placeholder dashboard**

Create `src/app/lecturer/page.tsx`:

```tsx
import { Card } from "@/components/ui/Card";

export default function LecturerDashboard() {
  return (
    <Card>
      <h1 className="text-lg font-semibold text-ink-900">Welcome to your Lecturer Dashboard</h1>
      <p className="mt-1 text-sm text-ink-500">
        Your courses, rosters, and gradebook will appear here.
      </p>
    </Card>
  );
}
```

- [ ] **Step 4: Implement the Admin placeholder dashboard**

Create `src/app/admin/page.tsx`:

```tsx
import { Card } from "@/components/ui/Card";

export default function AdminDashboard() {
  return (
    <Card>
      <h1 className="text-lg font-semibold text-ink-900">Welcome to the Admin Dashboard</h1>
      <p className="mt-1 text-sm text-ink-500">
        Manage students, lecturers, courses, fees, and notices here.
      </p>
    </Card>
  );
}
```

- [ ] **Step 5: Run the full automated suite**

Run: `npm test`
Expected: all passing (every test from Tasks 1–9).

- [ ] **Step 6: Manually verify the end-to-end flow**

Run: `npm run dev`, open `http://localhost:3000`.
Expected:
1. Redirects to `/login`.
2. Sign in with the Admin credentials from Task 9 Step 5.
3. Redirects to `/admin`, shows the Admin sidebar (Dashboard, Students, Lecturers, Courses, Fees & Payments, Notices, Support Tickets) and the placeholder welcome card.
4. Visiting `/student` while signed in as Admin redirects back to `/admin` (role-guard working).
5. Visiting `/admin` while signed out redirects to `/login`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire root redirect and placeholder role dashboards

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: README + push to GitHub

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: nothing consumed by later tasks; closes out the phase.

- [ ] **Step 1: Write the README**

Create `README.md`:

```markdown
# Student Management System

A role-based academic management system with three portals — **Student**,
**Lecturer**, and **Admin** — built on Next.js and Supabase.

See `docs/superpowers/specs/2026-08-19-student-management-system-design.md`
for the full design, and `docs/superpowers/plans/` for the phase-by-phase
implementation plans.

## Prerequisites

- Node.js 20+
- Docker Desktop (for local Supabase)

## Setup

\`\`\`bash
npm install
npx supabase start        # starts local Postgres/Auth; copy the printed
                           # keys into .env.local (see .env.local.example)
npx supabase migration up # applies the schema
npm run seed:admin -- you@example.com "YourPassword1!" "Your Name"
npm run dev
\`\`\`

Visit http://localhost:3000 and sign in with the admin account you seeded.

## Testing

\`\`\`bash
npm test
\`\`\`

Requires `supabase start` to be running (some tests hit the local Postgres/Auth
stack directly).
```

- [ ] **Step 2: Push to GitHub**

```bash
git push -u origin main
```

Expected: pushes successfully; `https://github.com/safwandotcom/Student-Management-System` shows the commit history.

- [ ] **Step 3: Verify on GitHub**

Run: `gh repo view safwandotcom/Student-Management-System --web` (or open the URL directly) and confirm the files are present.
