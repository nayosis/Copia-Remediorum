/**
 * Quantités de médicament : entiers en QUARTS d'unité, partout (base, fonctions, navigateur) ; jamais de flottants.
 * 1 comprimé = 4, ½ = 2, ¼ = 1. Comme les centimes de Cura Parentum.
 */

export const QUART = 1;
export const UNITE = 4;

const FRACTIONS: Record<number, string> = { 1: "¼", 2: "½", 3: "¾" };

/** 6 → « 1 ½ », 2 → « ½ », 12 → « 3 », -2 → « −½ ». */
export function quantiteLisible(quarts: number | null | undefined) {
  if (quarts == null) return "";
  const signe = quarts < 0 ? "−" : "";
  const q = Math.abs(quarts);
  const entier = Math.floor(q / UNITE);
  const reste = q % UNITE;
  if (!reste) return `${signe}${entier}`;
  return `${signe}${entier ? `${entier} ` : ""}${FRACTIONS[reste]}`;
}

/** Avec l'unité : « 12 comprimés », « ½ comprimé », « 1 ½ comprimé ». Accord au pluriel à partir de 2. */
export function quantiteAvecUnite(quarts: number, unite: string) {
  const pluriel = Math.abs(quarts) >= 2 * UNITE && !/[sx]$/.test(unite);
  return `${quantiteLisible(quarts)} ${unite}${pluriel ? "s" : ""}`;
}

/** Nombre saisi (1.5, 0.25) → quarts ; null si ce n'est pas un multiple de ¼ positif ou nul. */
export function versQuarts(n: number | string | null | undefined): number | null {
  if (n === null || n === undefined || n === "") return null;
  const v = typeof n === "string" ? Number(n.replace(",", ".").replace(/\s/g, "")) : n;
  if (!Number.isFinite(v) || v < 0) return null;
  const q = v * UNITE;
  return Math.abs(q - Math.round(q)) < 1e-9 ? Math.round(q) : null;
}

/** Quarts → nombre (pour les champs de saisie). */
export const depuisQuarts = (q: number) => q / UNITE;
