/*
 * Outils partagés par les fonctions de src/data/ (côté serveur uniquement).
 * Le « _ » du nom le retire du RPC : rien ici n'est appelable depuis le navigateur.
 */
import { existsSync, statSync } from "node:fs";
import { extname } from "node:path";
import { newId, query, type Statement } from "../db/client";
import { MIME_PAR_EXTENSION } from "../lib/documents";
import { ErreurMetier } from "../../serveur/erreurs";
import { cheminFichier, nomValide } from "../../serveur/fichiers";

/** Fichier déjà envoyé (POST /api/fichiers), à rattacher à une fiche. */
export type FichierARattacher = { fichier: string; nom: string };

export const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Instructions qui rattachent des fichiers envoyés à une note : présents sur le disque, jamais rattachés.
 * Type et taille relus sur le disque (le navigateur ne les fixe pas).
 */
export async function instructionsPiecesJointes(fichiers: FichierARattacher[], noteId: string): Promise<Statement[]> {
  const vus = new Set<string>();
  const sts: Statement[] = [];
  for (const f of fichiers) {
    if (!nomValide(f.fichier) || !existsSync(cheminFichier(f.fichier))) throw new ErreurMetier("Fichier introuvable : renvoyez-le.");
    const mime = MIME_PAR_EXTENSION[extname(f.fichier).slice(1)];
    if (!mime) throw new ErreurMetier("Type de fichier non pris en charge.");
    if (vus.has(f.fichier) || (await query("select 1 from piece_jointe where fichier = ?", [f.fichier])).length) throw new ErreurMetier("Ce fichier est déjà rattaché.");
    vus.add(f.fichier);
    sts.push({
      sql: "insert into piece_jointe (id, note_id, nom, fichier, mime, taille) values (?, ?, ?, ?, ?, ?)",
      params: [newId(), noteId, f.nom.trim() || f.fichier, f.fichier, mime, statSync(cheminFichier(f.fichier)).size],
    });
  }
  return sts;
}
