/*
 * Outils partagés par les fonctions de src/data/ (côté serveur uniquement).
 * Le « _ » du nom le retire du RPC : rien ici n'est appelable depuis le navigateur.
 */
import { query } from "../db/client";
import { ErreurMetier } from "../../serveur/erreurs";

export const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Délai d'alerte général, en jours avant l'épuisement (Paramètres) : 7 par défaut. */
export const DELAI_ALERTE_DEFAUT = 7;

export async function lireParametre(cle: string): Promise<string | null> {
  const [l] = await query("select valeur from parametre where cle = ?", [cle]);
  return (l?.[0] as string | undefined) ?? null;
}

export async function ecrireParametre(cle: string, valeur: string) {
  await query("insert into parametre (cle, valeur) values (?, ?) on conflict (cle) do update set valeur = excluded.valeur", [cle, valeur]);
}

export async function delaiAlerteGeneral() {
  const brut = await lireParametre("delai_alerte");
  const v = brut === null ? NaN : Number(brut);
  return Number.isInteger(v) && v >= 0 ? v : DELAI_ALERTE_DEFAUT;
}

/** Délai d'alerte saisi (jours) : entier de 0 à 120, ou null (délai général). */
export function verifierDelai(d: number | null | undefined) {
  if (d === null || d === undefined) return;
  if (!Number.isInteger(d) || d < 0 || d > 120) throw new ErreurMetier("Délai d'alerte invalide (0 à 120 jours).");
}

/** Une fiche existe-t-elle ? Sinon erreur 404 avec ce message. */
export async function exiger(table: string, id: string, message: string) {
  const [l] = await query(`select 1 from ${table} where id = ?`, [id]);
  if (!l) throw new ErreurMetier(message, 404);
}
