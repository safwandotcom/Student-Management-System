import { Card } from "@/components/ui/Card";

export default function LecturerDashboard() {
  return (
    <Card>
      <h1 className="text-lg font-semibold text-ink-900">Welcome to your Lecturer Dashboard</h1>
      <p className="mt-1 text-sm text-ink-500">
        Your courses, rosters, and gradebook will appear here.
      </p>
    </Card>
  );
}
