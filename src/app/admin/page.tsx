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
