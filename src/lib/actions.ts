import { prisma } from "./prisma";

/** Types d'événements du CRM terrain, journalisés dans le fil d'activité. */
export type ActionType =
  | "contact.cree"
  | "contact.statut"
  | "contact.relance"
  | "interaction.ajoutee"
  | "tache.creee"
  | "tache.faite"
  | "annonce.creee"
  | "annonce.publiee"
  | "annonce.pourvue"
  | "candidature.recue"
  | "candidature.qualifiee"
  | "transmission.envoyee"
  | "transmission.resultat"
  | "document.ajoute"
  | "asset.created"
  | "alert"
  | "report.sent";

export type Actor = "human" | "ai" | "system";

/**
 * Journalise une action dans la timeline (globale + par campagne). C'est le
 * fil qui retrace tout ce qui a été fait sur un dossier. Ne lève jamais :
 * un échec de log ne doit pas casser l'action métier.
 */
export async function logAction(input: {
  type: ActionType;
  title: string;
  actor?: Actor;
  detail?: string | null;
  status?: "done" | "pending" | "failed";
  refType?: "contact" | "annonce" | "candidature" | "transmission" | "qr" | "email" | null;
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
