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
