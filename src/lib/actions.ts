import { prisma } from "./prisma";

export type ActionType =
  | "asset.created"
  | "post.generated"
  | "post.published"
  | "post.scheduled"
  | "post.recycled"
  | "analysis.run"
  | "learning.saved"
  | "autopilot.run"
  | "alert"
  | "report.sent";

export type Actor = "human" | "ai" | "autopilot";

/**
 * Journalise une action dans la timeline (globale + par campagne). C'est le
 * fil qui relie une campagne à ce qui a été fait pour elle. Ne lève jamais :
 * un échec de log ne doit pas casser l'action métier.
 */
export async function logAction(input: {
  type: ActionType;
  title: string;
  actor?: Actor;
  detail?: string | null;
  status?: "done" | "pending" | "failed";
  refType?: "proprietaire" | "annonce" | "candidature" | "transmission" | "qr" | "email" | null;
  refId?: string | null;
}): Promise<void> {
  try {
    await prisma.action.create({
      data: {
        type: input.type,
        title: input.title,
        actor: input.actor ?? "human",
        detail: input.detail ?? null,
        status: input.status ?? "done",
        refType: input.refType ?? null,
        refId: input.refId ?? null,
      },
    });
  } catch (err) {
    console.error("logAction:", err);
  }
}
