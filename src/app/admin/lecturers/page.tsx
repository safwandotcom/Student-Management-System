import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseListParams, rangeForPage, DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface LecturerRow {
  id: string;
  department: string;
  designation: string;
  profiles: { full_name: string; status: string } | null;
}

export default async function LecturersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { search, page } = parseListParams(await searchParams);
  const [from, to] = rangeForPage(page);

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("lecturers")
    .select("id, department, designation, profiles(full_name, status)", { count: "exact" })
    .order("department", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to);

  if (search) {
    query = query.ilike("department", `%${search}%`);
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as LecturerRow[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Lecturers</h1>
          <p className="text-sm text-ink-500">Search by department.</p>
        </div>
        <Link href="/admin/lecturers/new">
          <Button>Add Lecturer</Button>
        </Link>
      </div>
      <Card>
        <DataTable
          basePath="/admin/lecturers"
          searchValue={search}
          searchPlaceholder="Search by department…"
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          totalCount={count ?? 0}
          rows={rows}
          rowKey={(row) => row.id}
          columns={[
            { header: "Name", cell: (row) => row.profiles?.full_name ?? "—" },
            { header: "Department", cell: (row) => row.department },
            { header: "Designation", cell: (row) => row.designation },
            {
              header: "Status",
              cell: (row) => (
                <Badge tone={row.profiles?.status === "active" ? "success" : "neutral"}>
                  {row.profiles?.status ?? "unknown"}
                </Badge>
              ),
            },
            {
              header: "",
              cell: (row) => (
                <Link href={`/admin/lecturers/${row.id}`} className="text-brand-700 hover:underline">
                  View
                </Link>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
