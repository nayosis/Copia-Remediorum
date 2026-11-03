/*
 * Référentiel : personnes suivies, médicaments, paramètres (délai d'alerte général).
 * Rien n'est supprimé : personnes et médicaments s'archivent (ils restent dans le journal et l'historique).
 */
import { asc, eq } from "drizzle-orm";
import { db, newId, query } from "../db/client";
import { medicament, personne } from "../db/schema";
import { ErreurMetier } from "../../serveur/erreurs";
import { aujourdhui } from "../lib/dates";
import { delaiAlerteGeneral, ecrireParametre, exiger, verifierDelai } from "./_commun";
import { sansTrace, verifierVersion, versionDe } from "./_version";

// --- Lecture

/** Personnes suivies, dans l'ordre choisi (les archivées à la fin, si demandées). */
export async function listePersonnes(f: { archivees?: boolean } = {}) {
  const lignes = await db.select().from(personne).orderBy(asc(personne.archivee), asc(personne.ordre), asc(personne.prenom));
  return f.archivees ? lignes : lignes.filter((p) => !p.archivee);
}

/** Médicaments, par nom, avec le nombre de traitements en cours. */
export async function listeMedicaments(f: { archives?: boolean } = {}) {
  const lignes = await query(
    `select m.id, (select count(*) from traitement t where t.medicament_id = m.id and (t.fin is null or t.fin >= ?)) from medicament m`,
    [aujourdhui()],
  );
  const enCours = new Map(lignes.map(([id, n]) => [id as string, Number(n)]));
  const meds = await db.select().from(medicament).orderBy(asc(medicament.archive), asc(medicament.nom));
  return meds.filter((m) => f.archives || !m.archive).map((m) => ({ ...m, traitementsEnCours: enCours.get(m.id) ?? 0 }));
}

export async function lireParametres() {
  return { delaiAlerte: await delaiAlerteGeneral() };
}

// --- Personnes

function verifierPrenom(prenom: string | undefined) {
  if (prenom !== undefined && !prenom.trim()) throw new ErreurMetier("Le prénom est obligatoire.");
}

export async function creerPersonne(v: { prenom: string }) {
  verifierPrenom(v.prenom);
  const id = newId();
  const [[n]] = await query("select coalesce(max(ordre), 0) + 1 from personne");
  await db.insert(personne).values({ id, prenom: v.prenom.trim(), ordre: Number(n) });
  return id;
}

export async function majPersonne(id: string, patch: { prenom?: string }, version?: string | null) {
  await exiger("personne", id, "Personne introuvable.");
  await verifierVersion("personne", id, version);
  verifierPrenom(patch.prenom);
  if (patch.prenom !== undefined) await db.update(personne).set({ prenom: patch.prenom.trim() }).where(eq(personne.id, id));
  return versionDe("personne", id);
}

/** Archive une personne : elle disparaît des listes ; ses traitements restent (arrêtez-les si besoin). */
export async function archiverPersonne(id: string, archivee: boolean) {
  await exiger("personne", id, "Personne introuvable.");
  await db.update(personne).set({ archivee }).where(eq(personne.id, id));
}

// --- Médicaments

type SaisieMedicament = { nom: string; unite?: string; seuilAlerte?: number | null; note?: string | null };

async function verifierMedicament(v: Partial<SaisieMedicament>, id?: string) {
  if (v.nom !== undefined) {
    if (!v.nom.trim()) throw new ErreurMetier("Le nom du médicament est obligatoire.");
    const meme = await query("select id from medicament where lower(trim(nom)) = lower(?) and archive = 0 and id <> ?", [v.nom.trim(), id ?? ""]);
    if (meme.length) throw new ErreurMetier(`« ${v.nom.trim()} » existe déjà.`);
  }
  if (v.unite !== undefined && !v.unite.trim()) throw new ErreurMetier("L'unité est obligatoire (comprimé, gélule…).");
  if (v.seuilAlerte !== undefined && v.seuilAlerte !== null && (!Number.isInteger(v.seuilAlerte) || v.seuilAlerte < 0))
    throw new ErreurMetier("Seuil d'alerte invalide.");
}

export async function creerMedicament(v: SaisieMedicament) {
  await verifierMedicament(v);
  const id = newId();
  await db.insert(medicament).values({
    id,
    nom: v.nom.trim(),
    unite: v.unite?.trim() || "comprimé",
    seuilAlerte: v.seuilAlerte ?? null,
    note: v.note?.trim() || null,
  });
  return id;
}

export async function majMedicament(id: string, patch: Partial<SaisieMedicament>, version?: string | null) {
  await exiger("medicament", id, "Médicament introuvable.");
  await verifierVersion("medicament", id, version);
  const v = sansTrace(patch);
  await verifierMedicament(v, id);
  await db
    .update(medicament)
    .set({
      ...(v.nom !== undefined ? { nom: v.nom.trim() } : {}),
      ...(v.unite !== undefined ? { unite: v.unite.trim() } : {}),
      ...(v.seuilAlerte !== undefined ? { seuilAlerte: v.seuilAlerte } : {}),
      ...(v.note !== undefined ? { note: v.note?.trim() || null } : {}),
    })
    .where(eq(medicament.id, id));
  return versionDe("medicament", id);
}

export async function archiverMedicament(id: string, archive: boolean) {
  await exiger("medicament", id, "Médicament introuvable.");
  await db.update(medicament).set({ archive }).where(eq(medicament.id, id));
}

// --- Paramètres

export async function majParametres(v: { delaiAlerte: number }) {
  verifierDelai(v.delaiAlerte);
  if (v.delaiAlerte === null || v.delaiAlerte === undefined) throw new ErreurMetier("Indiquez un délai d'alerte.");
  await ecrireParametre("delai_alerte", String(v.delaiAlerte));
}
