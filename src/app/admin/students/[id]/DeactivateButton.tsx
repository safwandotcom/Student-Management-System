"use client";

import { useTransition } from "react";
import { setProfileStatus } from "@/lib/admin/actions";
import { Button } from "@/components/ui/Button";

export function DeactivateButton({
  profileId,
  currentStatus,
  revalidateTo,
}: {
  profileId: string;
  currentStatus: string;
  revalidateTo: string;
}) {
  const [pending, startTransition] = useTransition();
  const isActive = currentStatus === "active";

  return (
    <Button
      variant={isActive ? "danger" : "secondary"}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          await setProfileStatus(profileId, isActive ? "inactive" : "active", revalidateTo);
        })
      }
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
