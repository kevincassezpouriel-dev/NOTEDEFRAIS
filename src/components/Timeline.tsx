"use client";

export interface ActionItem {
  id: string;
  type: string;
  actor: string;
  title: string;
  detail: string | null;
  status: string;
  createdAt: string;
  campaign?: { id: string; name: string } | null;
}

const ICONS: Record<string, string> = {
  "asset.created": "▣",
  "post.generated": "✨",
  "post.published": "🚀",
  "post.scheduled": "🗓️",
  "analysis.run": "📊",
  "learning.saved": "🧠",
  "autopilot.run": "🤖",
  "alert": "🔔",
  "report.sent": "📧",
};

const ACTOR_LABELS: Record<string, string> = {
  human: "vous",
  ai: "IA",
  autopilot: "autopilote",
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 604800) return `il y a ${Math.floor(s / 86400)} j`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

/** Fil d'activité : relie une campagne (ou tout le compte) à ses actions. */
export default function Timeline({
  actions,
  showCampaign = false,
}: {
  actions: ActionItem[];
  showCampaign?: boolean;
}) {
  if (actions.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Aucune activité pour le moment.
      </p>
    );
  }
  return (
    <ol className="space-y-3">
      {actions.map((a) => (
        <li key={a.id} className="flex gap-3">
          <div
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{ background: "var(--page)", border: "1px solid var(--grid)" }}
          >
            {ICONS[a.type] ?? "•"}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <p className="text-sm">
              {a.title}
              {a.status === "pending" && (
                <span
                  className="text-xs ml-2 px-1.5 py-0.5 rounded-full"
                  style={{ background: "var(--grid)", color: "var(--text-secondary)" }}
                >
                  en attente
                </span>
              )}
            </p>
            {a.detail && (
              <p className="text-xs mt-0.5 whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
                {a.detail}
              </p>
            )}
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {ACTOR_LABELS[a.actor] ?? a.actor} · {timeAgo(a.createdAt)}
              {showCampaign && a.campaign ? ` · ${a.campaign.name}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
