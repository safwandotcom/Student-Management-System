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
