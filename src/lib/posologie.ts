/*
 * Posologie d'un traitement : combien, à quels moments, quels jours. Fonctions pures, partagées par le serveur
 * (calcul du stock) et le navigateur (affichage). Quantités en quarts (src/lib/quantites.ts).
 * `null` : traitement sans posologie (« si douleur ») : aucune consommation calculée.
 */
import { ecartJours, jourSemaine } from "./dates";
import { quantiteLisible } from "./quantites";

export const MOMENTS = [
  { cle: "matin", libelle: "Matin" },
  { cle: "midi", libelle: "Midi" },
  { cle: "soir", libelle: "Soir" },
  { cle: "coucher", libelle: "Coucher" },
] as const;
export type Moment = (typeof MOMENTS)[number]["cle"];

export type Rythme =
  /** Tous les jours. */
  | { type: "quotidien" }
  /** Un jour sur N, à partir de la date de début du traitement (N = 2 : un jour sur deux). */
  | { type: "tous_les"; jours: number }
  /** Certains jours de la semaine : 1 = lundi … 7 = dimanche. */
  | { type: "semaine"; jours: number[] };

export type Posologie = { moments: Partial<Record<Moment, number>>; rythme: Rythme };

export const JOURS_SEMAINE = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/** Quarts pris un jour où le traitement est pris (somme des moments). */
export const parJourDePrise = (p: Posologie) => MOMENTS.reduce((t, m) => t + (p.moments[m.cle] ?? 0), 0);

/** Le traitement est-il pris ce jour-là (d'après le rythme, sans tenir compte des dates de début et de fin) ? */
export function estJourDePrise(p: Posologie, debut: string, jour: string) {
  const r = p.rythme;
  if (r.type === "quotidien") return true;
  if (r.type === "tous_les") {
    const e = ecartJours(debut, jour);
    return e >= 0 && e % r.jours === 0;
  }
  return r.jours.includes(jourSemaine(jour));
}

export type Periode = { debut: string; fin: string | null };

/** Quarts consommés ce jour-là par ce traitement (0 hors de ses dates, hors rythme, ou sans posologie). */
export function priseDuJour(p: Posologie | null, periode: Periode, jour: string) {
  if (!p || jour < periode.debut || (periode.fin && jour > periode.fin)) return 0;
  return estJourDePrise(p, periode.debut, jour) ? parJourDePrise(p) : 0;
}

/** Consommation moyenne par jour, en quarts (pour l'affichage : « environ 1 ½ par jour »). */
export function moyenneParJour(p: Posologie | null) {
  if (!p) return 0;
  const r = p.rythme;
  const parPrise = parJourDePrise(p);
  if (r.type === "quotidien") return parPrise;
  if (r.type === "tous_les") return parPrise / r.jours;
  return (parPrise * r.jours.length) / 7;
}

/** « 1 matin, ½ soir · un jour sur 2 » ; « Sans posologie (si besoin) ». */
export function posologieLisible(p: Posologie | null) {
  if (!p) return "Sans posologie (si besoin)";
  const moments = MOMENTS.filter((m) => p.moments[m.cle])
    .map((m) => `${quantiteLisible(p.moments[m.cle]!)} ${m.libelle.toLowerCase()}`)
    .join(", ");
  const r = p.rythme;
  const rythme =
    r.type === "quotidien"
      ? "tous les jours"
      : r.type === "tous_les"
        ? r.jours === 2
          ? "un jour sur deux"
          : `un jour sur ${r.jours}`
        : r.jours.length === 7
          ? "tous les jours"
          : [...r.jours].sort().map((j) => JOURS_SEMAINE[j - 1]).join(", ");
  return `${moments || "aucune prise"} · ${rythme}`;
}

/** Message d'erreur si la posologie est incohérente, sinon null. */
export function erreurPosologie(p: Posologie): string | null {
  if (!p || typeof p !== "object" || !p.moments || !p.rythme) return "Posologie illisible.";
  for (const [cle, q] of Object.entries(p.moments)) {
    if (!MOMENTS.some((m) => m.cle === cle)) return "Moment de prise inconnu.";
    if (!Number.isInteger(q) || q! < 0 || q! > 400) return "Quantité invalide (par quart d'unité).";
  }
  if (parJourDePrise(p) === 0) return "Indiquez au moins une prise (ou choisissez « sans posologie »).";
  const r = p.rythme;
  if (r.type === "tous_les" && (!Number.isInteger(r.jours) || r.jours < 2 || r.jours > 60)) return "Rythme invalide : un jour sur 2 à 60.";
  if (r.type === "semaine" && (!Array.isArray(r.jours) || !r.jours.length || r.jours.some((j) => !Number.isInteger(j) || j < 1 || j > 7)))
    return "Choisissez au moins un jour de la semaine.";
  if (!["quotidien", "tous_les", "semaine"].includes(r.type)) return "Rythme inconnu.";
  return null;
}
