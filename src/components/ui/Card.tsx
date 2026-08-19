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
