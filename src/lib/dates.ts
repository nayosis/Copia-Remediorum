/** Dates « AAAA-MM-JJ » affichées à la française : « 14 mars 2026 ». */
export function dateLisible(d: string | null | undefined, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) {
  if (!d) return "";
  const [a, m, j] = d.slice(0, 10).split("-").map(Number);
  // « 1 octobre » → « 1er octobre » (pas « 01/10 »).
  return new Date(a, m - 1, j).toLocaleDateString("fr-FR", options).replace(/(^|\s)1 (?=\p{L})/u, "$11er ");
}

/**
 * Fuseau des dates « du jour ». Le navigateur garde le sien ; le serveur fixe celui de l'installation
 * (TZ, Europe/Paris par défaut) : les données de fuseaux d'Intl ne dépendent pas de l'image système.
 */
let fuseau: string | undefined;
export const definirFuseau = (f: string) => {
  fuseau = f;
};

/** Date et heure locales (dans le fuseau ci-dessus). */
export function maintenantLocal(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: fuseau, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { jour: `${p.year}-${p.month}-${p.day}`, heure: Number(p.hour), jourSemaine: new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`).getUTCDay() };
}

/** Date du jour au format « AAAA-MM-JJ ». */
export const aujourdhui = () => maintenantLocal().jour;

/**
 * Date saisie au clavier : « 14/03/2025 », « 14-3-25 », « 14.03.2025 » ou « 2025-03-14 » → « 2025-03-14 ».
 * Null si la saisie n'est pas une date valide.
 */
export function lireDate(saisie: string): string | null {
  const s = saisie.trim();
  let a: number, m: number, j: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  const fr = /^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{2}|\d{4})$/.exec(s);
  if (iso) [a, m, j] = [+iso[1], +iso[2], +iso[3]];
  else if (fr) [j, m, a] = [+fr[1], +fr[2], fr[3].length === 2 ? 2000 + +fr[3] : +fr[3]];
  else return null;
  const d = new Date(Date.UTC(a, m - 1, j));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== j) return null;
  return d.toISOString().slice(0, 10);
}

/** « 2026-11-03 » + n jours (n négatif : avant). Calcul en UTC : pas de piège d'heure d'été. */
export function ajouterJours(jour: string, n: number) {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours de `de` à `a` (positif si `a` est après). */
export const ecartJours = (de: string, a: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);

/** Jour de la semaine d'une date : 1 = lundi … 7 = dimanche. */
export const jourSemaine = (jour: string) => new Date(`${jour}T12:00:00Z`).getUTCDay() || 7;
