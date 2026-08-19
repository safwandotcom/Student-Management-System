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
