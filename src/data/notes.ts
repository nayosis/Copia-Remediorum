/*
 * EXEMPLE — des notes avec pièces jointes, pour montrer chaque mécanisme du socle :
 * lecture et écriture par RPC, contrôles, transaction (batch), conflit d'écriture (version), archivage plutôt que
 * suppression, fichiers rattachés, règle réservée aux admins. À remplacer par le métier de l'application
 * (et serveur/modele.ts, src/lib/modele.ts, tests/notes.test.ts avec).
 */
import { and, desc, eq, getTableColumns, like, or, sql, type SQL } from "drizzle-orm";
import { batch, db, newId, query } from "../db/client";
import { note, pieceJointe } from "../db/schema";
import { ErreurMetier } from "../../serveur/erreurs";
import { adminCourant } from "../../serveur/tracabilite";
import { instructionsPiecesJointes, type FichierARattacher } from "./_commun";
import { sansTrace, verifierVersion, versionDe } from "./_version";

export type { FichierARattacher } from "./_commun";
export type Filtre = { recherche?: string; archivees?: boolean };

const NB_PIECES = sql<number>`(select count(*) from piece_jointe p where p.note_id = "note"."id" and p.archive = 0)`;

// --- Lecture (déclarées dans LECTURES, serveur/modele.ts)

/** Notes, des plus récemment modifiées aux plus anciennes, avec leur nombre de pièces jointes. */
export async function listeNotes(f: Filtre = {}) {
  const conditions: SQL[] = [eq(note.archivee, !!f.archivees)];
  const r = f.recherche?.trim();
  if (r) conditions.push(or(like(note.titre, `%${r}%`), like(note.texte, `%${r}%`))!);
  return db
    .select({ ...getTableColumns(note), nbPieces: NB_PIECES })
    .from(note)
    .where(and(...conditions))
    .orderBy(desc(note.modifieLe));
}

/** Une note, avec toutes ses pièces jointes (retirées comprises, pour la preuve). */
export async function ficheNote(id: string) {
  const [n] = await db.select().from(note).where(eq(note.id, id));
  if (!n) throw new ErreurMetier("Note introuvable.", 404);
  const pieces = await db.select().from(pieceJointe).where(eq(pieceJointe.noteId, id)).orderBy(pieceJointe.creeLe);
  return { ...n, pieces };
}

/** Page d'accueil : quelques chiffres et les dernières notes. */
export async function accueil() {
  const [[actives], [archivees], [pieces]] = await Promise.all([
    query("select count(*) from note where archivee = 0"),
    query("select count(*) from note where archivee = 1"),
    query("select count(*) from piece_jointe where archive = 0"),
  ]);
  const dernieres = (await listeNotes()).slice(0, 5);
  return { actives: Number(actives[0]), archivees: Number(archivees[0]), pieces: Number(pieces[0]), dernieres };
}

// --- Contrôles

type Saisie = { titre: string; texte?: string | null };

function verifierSaisie(v: Partial<Saisie>) {
  if (v.titre !== undefined && !v.titre.trim()) throw new ErreurMetier("Le titre est obligatoire.");
  if (v.titre !== undefined && v.titre.trim().length > 200) throw new ErreurMetier("Titre trop long (200 caractères au plus).");
}

/** Une note archivée ne se modifie plus, sauf par un admin (règle d'exemple : verrouillage d'une fiche). */
async function verifierModifiable(id: string) {
  const [l] = await query("select archivee from note where id = ?", [id]);
  if (!l) throw new ErreurMetier("Note introuvable.", 404);
  if (l[0] && !adminCourant()) throw new ErreurMetier("Cette note est archivée : seul un admin peut la modifier.", 403);
}

// --- Écriture (journalisées, diffusées ; le premier argument UUID désigne la fiche pour le journal)

/** Nouvelle note, avec ses pièces jointes, d'un seul tenant. Renvoie son identifiant. */
export async function creerNote(v: Saisie & { pieces?: FichierARattacher[] }) {
  verifierSaisie(v);
  const id = newId();
  await batch([
    { sql: "insert into note (id, titre, texte) values (?, ?, ?)", params: [id, v.titre.trim(), v.texte?.trim() || null] },
    ...(await instructionsPiecesJointes(v.pieces ?? [], id)),
  ]);
  return id;
}

/**
 * Modifie une note. `version` : le `modifieLe` lu par le navigateur ; si quelqu'un d'autre l'a modifiée depuis,
 * l'écriture est refusée (409). Renvoie la nouvelle version.
 */
export async function majNote(id: string, patch: Partial<Saisie>, version?: string | null) {
  await verifierModifiable(id);
  await verifierVersion("note", id, version);
  const v = sansTrace(patch);
  verifierSaisie(v);
  await db
    .update(note)
    .set({ ...(v.titre !== undefined ? { titre: v.titre.trim() } : {}), ...(v.texte !== undefined ? { texte: v.texte?.trim() || null } : {}) })
    .where(eq(note.id, id));
  return versionDe("note", id);
}

/** Archive (ou ressort des archives) une note : rien n'est effacé. */
export async function archiverNote(id: string, archivee: boolean) {
  const [l] = await query("select 1 from note where id = ?", [id]);
  if (!l) throw new ErreurMetier("Note introuvable.", 404);
  if (!archivee && !adminCourant()) throw new ErreurMetier("Seul un admin peut ressortir une note des archives.", 403);
  await query("update note set archivee = ? where id = ?", [archivee ? 1 : 0, id]);
}

/** Ajoute des pièces jointes à une note. */
export async function ajouterPieces(id: string, pieces: FichierARattacher[]) {
  await verifierModifiable(id);
  if (!pieces.length) return;
  await batch(await instructionsPiecesJointes(pieces, id));
}

/** Retire une pièce jointe : elle est archivée (le fichier reste, consultable depuis le journal). */
export async function retirerPiece(id: string) {
  const [l] = await query("select note_id from piece_jointe where id = ?", [id]);
  if (!l) throw new ErreurMetier("Pièce jointe introuvable.", 404);
  await verifierModifiable(String(l[0]));
  await query("update piece_jointe set archive = 1 where id = ?", [id]);
}
