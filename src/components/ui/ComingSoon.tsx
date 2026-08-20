import { Card } from "@/components/ui/Card";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <Card className="space-y-2">
      <h1 className="text-lg font-semibold text-ink-900">{title}</h1>
      <p className="text-sm text-ink-500">{description}</p>
    </Card>
  );
}
