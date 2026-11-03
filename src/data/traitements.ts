/*
 * Traitements : un médicament pris par une personne, avec sa posologie (src/lib/posologie.ts).
 * Un traitement terminé garde sa date de fin : il ne consomme plus, et reste visible dans l'historique.
 */
import { and, asc, eq, getTableColumns, gte, isNull, or, sql, type SQL } from "drizzle-orm";
import { batch, db, newId, query, type Statement } from "../db/client";
import { medicament, personne, traitement } from "../db/schema";
import { ErreurMetier } from "../../serveur/erreurs";
import { adminCourant } from "../../serveur/tracabilite";
import { aujourdhui } from "../lib/dates";
import { erreurPosologie, type Posologie } from "../lib/posologie";
import { DATE, exiger, verifierDelai } from "./_commun";
import { sansTrace, verifierVersion, versionDe } from "./_version";

export type SaisieTraitement = {
  personneId: string;
  medicamentId: string;
  /** null : sans posologie (si besoin). */
  posologie: Posologie | null;
  debut: string;
  fin?: string | null;
  /** Jours avant l'épuisement ; null : délai général. */
  delaiAlerte?: number | null;
  note?: string | null;
};

/** Ligne de traitement telle que la base la renvoie, posologie lue. */
export const lirePosologie = (json: string | null): Posologie | null => (json ? (JSON.parse(json) as Posologie) : null);

// --- Lecture

/** Traitements (en cours par défaut ; `termines` : aussi ceux dont la date de fin est passée), par personne et médicament. */
export async function listeTraitements(f: { personneId?: string; medicamentId?: string; termines?: boolean } = {}) {
  const conditions: SQL[] = [];
  if (f.personneId) conditions.push(eq(traitement.personneId, f.personneId));
  if (f.medicamentId) conditions.push(eq(traitement.medicamentId, f.medicamentId));
  if (!f.termines) conditions.push(or(isNull(traitement.fin), gte(traitement.fin, aujourdhui()))!);
  const lignes = await db
    .select({ ...getTableColumns(traitement), prenom: personne.prenom, medicament: medicament.nom, unite: medicament.unite })
    .from(traitement)
    .innerJoin(personne, eq(personne.id, traitement.personneId))
    .innerJoin(medicament, eq(medicament.id, traitement.medicamentId))
    .where(and(...conditions))
    .orderBy(asc(personne.ordre), asc(personne.prenom), asc(sql`lower(${medicament.nom})`));
  return lignes.map((l) => ({ ...l, posologie: lirePosologie(l.posologie) }));
}

// --- Contrôles

async function verifierSaisie(v: Partial<SaisieTraitement>) {
  if (v.personneId !== undefined) await exiger("personne", v.personneId, "Personne inconnue.");
  if (v.medicamentId !== undefined) await exiger("medicament", v.medicamentId, "Médicament inconnu.");
  if (v.posologie) {
    const e = erreurPosologie(v.posologie);
    if (e) throw new ErreurMetier(e);
  }
  if (v.debut !== undefined && !DATE.test(v.debut)) throw new ErreurMetier("Date de début invalide.");
  if (v.fin !== undefined && v.fin !== null && !DATE.test(v.fin)) throw new ErreurMetier("Date de fin invalide.");
  verifierDelai(v.delaiAlerte);
}

const verifierDates = (debut: string, fin: string | null) => {
  if (fin && fin < debut) throw new ErreurMetier("La date de fin précède la date de début.");
};

// --- Écriture

/**
 * Nouveau traitement. Si son médicament n'a encore aucun stock (ni partagé, ni propre à la personne), un stock partagé
 * est créé : c'est le cas courant (l'armoire commune) ; un stock propre se crée ensuite depuis la page des stocks.
 */
export async function creerTraitement(v: SaisieTraitement) {
  await verifierSaisie(v);
  verifierDates(v.debut, v.fin ?? null);
  const id = newId();
  const stocks = await query("select 1 from stock where medicament_id = ? and archive = 0 and (personne_id is null or personne_id = ?)", [v.medicamentId, v.personneId]);
  const sts: Statement[] = stocks.length ? [] : [{ sql: "insert into stock (id, medicament_id) values (?, ?)", params: [newId(), v.medicamentId] }];
  await batch([
    ...sts,
    {
      sql: "insert into traitement (id, personne_id, medicament_id, posologie, debut, fin, delai_alerte, note) values (?, ?, ?, ?, ?, ?, ?, ?)",
      params: [id, v.personneId, v.medicamentId, v.posologie ? JSON.stringify(v.posologie) : null, v.debut, v.fin ?? null, v.delaiAlerte ?? null, v.note?.trim() || null],
    },
  ]);
  return id;
}

/** Modifie un traitement (posologie changée par le médecin, arrêt : date de fin). Personne et médicament ne changent pas. */
export async function majTraitement(id: string, patch: Partial<Omit<SaisieTraitement, "personneId" | "medicamentId">>, version?: string | null) {
  const [t] = await db.select().from(traitement).where(eq(traitement.id, id));
  if (!t) throw new ErreurMetier("Traitement introuvable.", 404);
  await verifierVersion("traitement", id, version);
  const v = sansTrace(patch);
  await verifierSaisie(v);
  verifierDates(v.debut ?? t.debut, v.fin !== undefined ? v.fin : t.fin);
  await db
    .update(traitement)
    .set({
      ...(v.posologie !== undefined ? { posologie: v.posologie ? JSON.stringify(v.posologie) : null } : {}),
      ...(v.debut !== undefined ? { debut: v.debut } : {}),
      ...(v.fin !== undefined ? { fin: v.fin } : {}),
      ...(v.delaiAlerte !== undefined ? { delaiAlerte: v.delaiAlerte } : {}),
      ...(v.note !== undefined ? { note: v.note?.trim() || null } : {}),
    })
    .where(eq(traitement.id, id));
  return versionDe("traitement", id);
}

/** Supprime un traitement saisi par erreur (admins) ; pour un arrêt, mettre une date de fin. Le journal garde la fiche. */
export async function supprimerTraitement(id: string) {
  await exiger("traitement", id, "Traitement introuvable.");
  if (!adminCourant()) throw new ErreurMetier("Seul un admin peut supprimer un traitement ; pour un arrêt, indiquez une date de fin.", 403);
  await db.delete(traitement).where(eq(traitement.id, id));
}
