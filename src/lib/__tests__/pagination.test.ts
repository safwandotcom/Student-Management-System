import { describe, it, expect } from "vitest";
import { parseListParams, rangeForPage, DEFAULT_PAGE_SIZE } from "../pagination";

describe("parseListParams", () => {
  it("defaults to empty search and page 1", () => {
    expect(parseListParams({})).toEqual({ search: "", page: 1 });
  });

  it("trims whitespace from search", () => {
    expect(parseListParams({ search: "  ali  " })).toEqual({ search: "ali", page: 1 });
  });

  it("parses a valid page number", () => {
    expect(parseListParams({ page: "3" })).toEqual({ search: "", page: 3 });
  });

  it("falls back to page 1 for an invalid page value", () => {
    expect(parseListParams({ page: "not-a-number" })).toEqual({ search: "", page: 1 });
    expect(parseListParams({ page: "0" })).toEqual({ search: "", page: 1 });
    expect(parseListParams({ page: "-5" })).toEqual({ search: "", page: 1 });
  });

  it("floors a fractional page value", () => {
    expect(parseListParams({ page: "2.9" })).toEqual({ search: "", page: 2 });
  });
});

describe("rangeForPage", () => {
  it("returns [0, pageSize-1] for page 1", () => {
    expect(rangeForPage(1, 20)).toEqual([0, 19]);
  });

  it("returns the next window for page 2", () => {
    expect(rangeForPage(2, 20)).toEqual([20, 39]);
  });

  it("defaults pageSize to DEFAULT_PAGE_SIZE", () => {
    expect(rangeForPage(1)).toEqual([0, DEFAULT_PAGE_SIZE - 1]);
  });
});
