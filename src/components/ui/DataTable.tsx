import Link from "next/link";
import { ReactNode } from "react";
import { clsx } from "clsx";

export interface DataTableColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  searchValue: string;
  page: number;
  pageSize: number;
  totalCount: number;
  basePath: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchPlaceholder,
  searchValue,
  page,
  pageSize,
  totalCount,
  basePath,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div>
      <form method="GET" action={basePath} className="mb-4 flex gap-2">
        <input
          type="text"
          name="search"
          defaultValue={searchValue}
          placeholder={searchPlaceholder ?? "Search…"}
          className="w-full max-w-sm rounded-md border border-ink-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-ink-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-ink-600">
            <tr>
              {columns.map((col) => (
                <th key={col.header} className="px-4 py-3 font-medium">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-ink-500">
                  No results.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((col) => (
                    <td key={col.header} className="px-4 py-3">
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-ink-600">
        <span>
          Page {page} of {totalPages} ({totalCount} total)
        </span>
        <div className="flex gap-2">
          <Link
            href={`${basePath}?search=${encodeURIComponent(searchValue)}&page=${Math.max(1, page - 1)}`}
            className={clsx(
              "rounded-md border border-ink-300 px-3 py-1.5",
              page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-ink-50"
            )}
          >
            Previous
          </Link>
          <Link
            href={`${basePath}?search=${encodeURIComponent(searchValue)}&page=${Math.min(totalPages, page + 1)}`}
            className={clsx(
              "rounded-md border border-ink-300 px-3 py-1.5",
              page >= totalPages ? "pointer-events-none opacity-50" : "hover:bg-ink-50"
            )}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
