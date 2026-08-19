export const DEFAULT_PAGE_SIZE = 20;

export interface ParsedListParams {
  search: string;
  page: number;
}

export function parseListParams(searchParams: { search?: string; page?: string }): ParsedListParams {
  const search = searchParams.search?.trim() ?? "";
  const pageNum = Number(searchParams.page);
  const page = Number.isFinite(pageNum) && pageNum >= 1 ? Math.floor(pageNum) : 1;
  return { search, page };
}

export function rangeForPage(page: number, pageSize: number = DEFAULT_PAGE_SIZE): [number, number] {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return [from, to];
}
