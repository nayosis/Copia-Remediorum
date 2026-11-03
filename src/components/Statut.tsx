import { Badge } from "@mantine/core";
import type { EtatStock, Statut } from "../lib/stock";
import { dateLisible, ecartJours } from "../lib/dates";

export const STATUTS: Record<Statut, { libelle: string; couleur: string }> = {
  epuise: { libelle: "Épuisé", couleur: "red" },
  alerte: { libelle: "À renouveler", couleur: "orange" },
  inconnu: { libelle: "À pointer", couleur: "gray" },
  ok: { libelle: "OK", couleur: "marque" },
  sans_suivi: { libelle: "Si besoin", couleur: "gray" },
};

export function BadgeStatut({ etat, size = "sm" }: { etat: EtatStock; size?: string }) {
  const s = STATUTS[etat.statut];
  return (
    <Badge style={{ flexShrink: 0, overflow: "visible" }} color={s.couleur} variant={etat.statut === "ok" || etat.statut === "sans_suivi" ? "light" : "filled"} size={size}>
      {s.libelle}
    </Badge>
  );
}

const court = (d: string) => dateLisible(d, { day: "numeric", month: "short" });

/** « épuisé vers le 28 nov. (dans 12 jours) », « épuisé depuis le 2 nov. », « sous le seuil », « pas de pointage ». */
export function echeanceLisible(etat: EtatStock, aujourdhui: string) {
  if (etat.statut === "inconnu") return "Jamais pointé : comptez les boîtes pour lancer le calcul.";
  if (etat.epuisement) {
    const n = ecartJours(aujourdhui, etat.epuisement);
    if (n <= 0) return `Épuisé depuis le ${court(etat.epuisement)}`;
    if (n > 120) return `Épuisé dans plus de 4 mois (${dateLisible(etat.epuisement, { month: "long", year: "numeric" })})`;
    return `Épuisé vers le ${court(etat.epuisement)} (dans ${n} jour${n > 1 ? "s" : ""})`;
  }
  if (etat.sousSeuil) return "Sous le seuil d'alerte";
  return etat.statut === "sans_suivi" ? "Pris si besoin : pas d'épuisement calculé" : "Pas d'épuisement prévu";
}
