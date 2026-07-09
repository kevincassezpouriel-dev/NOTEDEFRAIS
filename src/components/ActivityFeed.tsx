"use client";

import { useEffect, useState } from "react";
import Timeline, { ActionItem } from "./Timeline";

/** Fil d'activité global (autopilote, publications, analyses, alertes…). */
export default function ActivityFeed() {
  const [actions, setActions] = useState<ActionItem[]>([]);

  useEffect(() => {
    fetch("/api/admin/actions?limit=20", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setActions)
      .catch(() => {});
  }, []);

  return <Timeline actions={actions} showCampaign />;
}
