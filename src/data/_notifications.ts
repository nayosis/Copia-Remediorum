/*
 * Ce que l'application notifie, et quand (docs/conception.md, Notifications) : le jour où un stock entre en alerte,
 * puis une fois par semaine tant qu'il y reste (un pointage qui repousse l'épuisement au-delà du délai l'en fait
 * sortir, et la série recommence à la prochaine alerte). Côté serveur uniquement (« _ » : hors RPC).
 */
import { ecrireReglage, lireReglage } from "../../serveur/reglages";
import type { Notification } from "../../serveur/push";
import { ajouterJours, dateLisible } from "../lib/dates";
import { listeStocks, type StockCalcule } from "./stocks";

const RAPPEL_JOURS = 7;
const CLE = "notifications_stocks";

const court = (d: string) => dateLisible(d, { day: "numeric", month: "short" });

/** « Kardégic 75 mg (Jeanne, Robert) : épuisé vers le 10 nov. » */
function ligne(s: StockCalcule, jour: string) {
  const qui = [...new Set(s.traitements.filter((t) => !t.fin || t.fin >= jour).map((t) => t.prenom))].join(", ") || s.prenom || "partagé";
  const quand = s.etat.statut === "epuise" ? "épuisé" : s.etat.epuisement ? `épuisé vers le ${court(s.etat.epuisement)}` : "sous le seuil d'alerte";
  return { qui, texte: `${s.medicament} (${qui}) : ${quand}` };
}

/** Notifications à envoyer ce jour-là ; retient, par stock, le jour du dernier envoi. */
export async function notificationsDuJour(jour: string): Promise<Notification[]> {
  const envois: Record<string, string> = JSON.parse(lireReglage(CLE) ?? "{}");
  const enAlerte = (await listeStocks({ jour })).filter(
    (s) => (s.etat.statut === "alerte" || s.etat.statut === "epuise") && s.traitements.some((t) => !t.fin || t.fin >= jour),
  );
  const dus = enAlerte.filter((s) => !envois[s.id] || envois[s.id] <= ajouterJours(jour, -RAPPEL_JOURS));
  // Sortis de l'alerte : la série est terminée.
  const suivis = Object.fromEntries(enAlerte.map((s) => [s.id, envois[s.id]]).filter(([, d]) => d));
  for (const s of dus) suivis[s.id] = jour;
  ecrireReglage(CLE, JSON.stringify(suivis));
  if (!dus.length) return [];
  if (dus.length === 1) {
    const [s] = dus;
    const l = ligne(s, jour);
    return [{ titre: `${s.medicament} : à renouveler`, texte: `${l.texte}. Pensez à l'ordonnance.`, url: `/stocks/${s.id}`, etiquette: "renouveler" }];
  }
  return [{ titre: `${dus.length} médicaments à renouveler`, texte: dus.map((s) => ligne(s, jour).texte).join("\n"), url: "/", etiquette: "renouveler" }];
}
