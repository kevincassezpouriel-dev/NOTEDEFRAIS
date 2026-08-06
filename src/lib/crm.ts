/**
 * CRM terrain — vocabulaire métier et scoring d'affinité.
 *
 * Le scoring est une fonction PURE (aucun appel réseau, aucune IA) : elle
 * croise le profil d'un candidat avec les contraintes de l'annonce et le
 * brief du propriétaire, et renvoie une note 1-5 accompagnée de ses raisons.
 * L'opérateur garde toujours le dernier mot : le score suggéré ne fait que
 * préparer sa décision.
 */

/* ---------------- Vocabulaire ---------------- */

export const PROPRIETAIRE_TYPES = [
  { value: "coloc_existante", label: "Coloc existante" },
  { value: "proprietaire_particulier", label: "Propriétaire particulier" },
  { value: "proprietaire_multi", label: "Propriétaire multi-biens" },
  { value: "agence", label: "Agence" },
  { value: "residence", label: "Résidence" },
] as const;

export const PROPRIETAIRE_SOURCES = [
  { value: "leboncoin", label: "Leboncoin" },
  { value: "pap", label: "PAP" },
  { value: "roomlala", label: "Roomlala" },
  { value: "facebook", label: "Facebook" },
  { value: "terrain", label: "Terrain" },
  { value: "bouche_a_oreille", label: "Bouche-à-oreille" },
  { value: "entrant_spontane", label: "Entrant spontané" },
  { value: "autre", label: "Autre" },
] as const;

/** Pipeline de démarchage, dans l'ordre. */
export const PROPRIETAIRE_STATUTS = [
  { value: "a_contacter", label: "À contacter", color: "var(--text-muted)" },
  { value: "contacte", label: "Contacté", color: "var(--series-1)" },
  { value: "relance_1", label: "Relance 1", color: "var(--series-3)" },
  { value: "relance_2", label: "Relance 2", color: "var(--series-3)" },
  { value: "accord_obtenu", label: "Accord obtenu", color: "var(--good)" },
  { value: "refus", label: "Refus", color: "var(--critical)" },
  { value: "injoignable", label: "Injoignable", color: "var(--text-muted)" },
] as const;

export const ANNONCE_STATUTS = [
  { value: "brouillon", label: "Brouillon", color: "var(--text-muted)" },
  { value: "en_ligne", label: "En ligne", color: "var(--good)" },
  { value: "pourvue", label: "Pourvue", color: "var(--series-1)" },
  { value: "archivee", label: "Archivée", color: "var(--text-muted)" },
] as const;

export const CANDIDATURE_STATUTS = [
  { value: "a_qualifier", label: "À qualifier", color: "var(--series-3)" },
  { value: "qualifie", label: "Qualifié", color: "var(--series-1)" },
  { value: "transmis", label: "Transmis", color: "var(--accent)" },
  { value: "installe", label: "Installé", color: "var(--good)" },
  { value: "ecarte", label: "Écarté", color: "var(--text-muted)" },
  { value: "sans_suite", label: "Sans suite", color: "var(--text-muted)" },
] as const;

export const STATUTS_PRO = [
  { value: "etudiant", label: "Étudiant" },
  { value: "jeune_actif", label: "Jeune actif" },
  { value: "alternant", label: "Alternant" },
  { value: "stagiaire", label: "Stagiaire" },
  { value: "autre", label: "Autre" },
] as const;

export const GARANTS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "a_verifier", label: "À vérifier" },
] as const;

export const RYTHMES = [
  { value: "couche_tot", label: "Couche-tôt" },
  { value: "couche_tard", label: "Couche-tard" },
  { value: "flexible", label: "Flexible" },
] as const;

export const INVITES = [
  { value: "jamais", label: "Jamais" },
  { value: "parfois", label: "Parfois" },
  { value: "souvent", label: "Souvent" },
] as const;

export const CANAUX = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "mail", label: "E-mail" },
  { value: "appel", label: "Appel" },
  { value: "autre", label: "Autre" },
] as const;

export const RESULTATS = [
  { value: "en_attente", label: "En attente", color: "var(--series-3)" },
  { value: "visite_prevue", label: "Visite prévue", color: "var(--series-1)" },
  { value: "visite_faite", label: "Visite faite", color: "var(--series-1)" },
  { value: "accepte_installe", label: "Accepté / installé", color: "var(--good)" },
  { value: "refuse_par_coloc", label: "Refusé par la coloc", color: "var(--critical)" },
  { value: "refuse_par_candidat", label: "Refusé par le candidat", color: "var(--critical)" },
  { value: "sans_reponse", label: "Sans réponse", color: "var(--text-muted)" },
] as const;

export const DOCUMENT_TYPES = [
  { value: "accord_publication", label: "Accord de publication" },
  { value: "fiche_candidat", label: "Fiche candidat" },
  { value: "dossier_locataire", label: "Dossier locataire" },
  { value: "autre", label: "Autre" },
] as const;

/** Libellé lisible depuis une liste de valeurs. */
export function labelOf(
  list: readonly { value: string; label: string }[],
  value: string | null | undefined
): string {
  return list.find((i) => i.value === value)?.label ?? value ?? "—";
}

export function colorOf(
  list: readonly { value: string; label: string; color?: string }[],
  value: string | null | undefined
): string {
  return list.find((i) => i.value === value)?.color ?? "var(--text-muted)";
}

/* ---------------- Scoring d'affinité ---------------- */

export interface ScorableCandidature {
  budgetMax?: number | null;
  dateDispo?: Date | string | null;
  garant?: string | null;
  statutPro?: string | null;
  rythme?: string | null;
  menage?: number | null;
  fetes?: number | null;
  invites?: string | null;
  fumeur?: boolean | null;
  animaux?: boolean | null;
  motivation?: string | null;
}

export interface ScorableAnnonce {
  loyer?: number | null;
  charges?: number | null;
  dateDispo?: Date | string | null;
}

export interface ScoreResult {
  score: number; // 1 à 5
  raisons: string[]; // ce qui a joué, en clair, du plus fort au plus faible
}

/** Normalise pour comparer du texte libre (accents, casse). */
function norm(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const has = (t: string, ...mots: string[]) => mots.some((m) => t.includes(norm(m)));

/**
 * Score d'affinité suggéré (1-5) : croise le candidat, l'annonce et le brief
 * du propriétaire. Chaque critère ajoute ou retire des points et laisse une
 * trace lisible, pour que la décision reste explicable.
 */
export function suggestScore(
  candidature: ScorableCandidature,
  annonce: ScorableAnnonce,
  briefRecherche?: string | null
): ScoreResult {
  const brief = norm(briefRecherche ?? "");
  const raisons: string[] = [];
  let score = 3;

  const add = (points: number, raison: string) => {
    score += points;
    raisons.push(`${points > 0 ? "+" : "−"} ${raison}`);
  };

  // --- Budget : le critère éliminatoire numéro un ---
  const coutTotal = (annonce.loyer ?? 0) + (annonce.charges ?? 0);
  if (coutTotal > 0 && candidature.budgetMax != null) {
    if (candidature.budgetMax >= coutTotal) add(1, `budget suffisant (${candidature.budgetMax} € ≥ ${coutTotal} €)`);
    else if (candidature.budgetMax >= coutTotal * 0.9)
      add(-0.5, `budget juste (${candidature.budgetMax} € pour ${coutTotal} €)`);
    else add(-2, `budget insuffisant (${candidature.budgetMax} € pour ${coutTotal} €)`);
  }

  // --- Garant : rassure le propriétaire ---
  if (candidature.garant === "oui") add(0.5, "garant confirmé");
  else if (candidature.garant === "non") add(-1, "pas de garant");

  // --- Disponibilité alignée ---
  if (annonce.dateDispo && candidature.dateDispo) {
    const dAnnonce = new Date(annonce.dateDispo).getTime();
    const dCandidat = new Date(candidature.dateDispo).getTime();
    const ecartJours = Math.abs(dCandidat - dAnnonce) / 86_400_000;
    if (ecartJours <= 15) add(0.5, "disponible à la bonne date");
    else if (ecartJours > 60) add(-1, `disponibilité décalée d'environ ${Math.round(ecartJours)} jours`);
  }

  // --- Tabac : souvent rédhibitoire quand c'est écrit dans le brief ---
  if (has(brief, "non-fumeur", "non fumeur", "pas de fumeur", "sans tabac", "ne fume pas")) {
    if (candidature.fumeur) add(-2, "fumeur alors que le brief demande non-fumeur");
    else add(0.5, "non-fumeur, conforme au brief");
  }

  // --- Animaux ---
  if (has(brief, "pas d'animaux", "sans animaux", "pas d animaux", "aucun animal")) {
    if (candidature.animaux) add(-2, "animal alors que le brief l'exclut");
    else add(0.5, "sans animal, conforme au brief");
  }

  // --- Calme / ambiance festive ---
  const briefCalme = has(brief, "calme", "tranquille", "studieux", "serieux", "pose", "sérieux");
  const briefFestif = has(brief, "festif", "convivial", "vie", "sortir", "fete", "ambiance");
  const fetes = candidature.fetes ?? 3;
  if (briefCalme) {
    if (fetes >= 4) add(-1.5, "profil festif alors que le brief demande du calme");
    else if (fetes <= 2) add(1, "profil calme, en phase avec le brief");
  } else if (briefFestif && fetes >= 4) {
    add(0.5, "profil convivial, en phase avec le brief");
  }

  // --- Propreté ---
  if (has(brief, "propre", "menage", "ordre", "rangé", "range", "proprete")) {
    const menage = candidature.menage ?? 3;
    if (menage >= 4) add(1, "exigeant sur le ménage, conforme au brief");
    else if (menage <= 2) add(-1, "peu regardant sur le ménage alors que le brief y tient");
  }

  // --- Invités ---
  if (briefCalme && candidature.invites === "souvent") {
    add(-0.5, "reçoit souvent alors que le brief demande du calme");
  }

  // --- Rythme de vie ---
  if (has(brief, "couche tot", "couche-tot", "leve tot", "matinal") && candidature.rythme === "couche_tard") {
    add(-0.5, "couche-tard face à un brief plutôt matinal");
  }

  // --- Statut professionnel attendu ---
  if (has(brief, "etudiant") && candidature.statutPro === "etudiant") add(0.5, "étudiant, profil recherché");
  if (
    has(brief, "jeune actif", "salarie", "travaille", "actif") &&
    (candidature.statutPro === "jeune_actif" || candidature.statutPro === "alternant")
  ) {
    add(0.5, "jeune actif / alternant, profil recherché");
  }

  // --- Motivation : signal d'implication ---
  const longueur = (candidature.motivation ?? "").trim().length;
  if (longueur >= 400) add(0.5, "motivation détaillée et personnalisée");
  else if (longueur > 0 && longueur < 150) add(-0.5, "motivation très courte");

  const finale = Math.max(1, Math.min(5, Math.round(score)));
  if (raisons.length === 0) raisons.push("aucun critère discriminant : à qualifier à la main");
  return { score: finale, raisons };
}

/** Nombre de jours écoulés depuis une date (pour les alertes de relance). */
export function joursDepuis(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}
