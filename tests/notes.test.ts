/*
 * EXEMPLE — tests du module notes : chaque règle de docs/conception.md a son test, passé par l'API (droits compris).
 * À remplacer avec le module.
 */
import { describe, expect, test } from "bun:test";
import { SUPER, serveurDeTest } from "./outils-serveur";

const s = await serveurDeTest();
const { cookie } = await s.connexion(SUPER.email, SUPER.motDePasse);
const ecrivain = await s.compte("ecriture@famille.fr", "ecriture");

const appel = async (nom: string, args: unknown[], c = cookie) => {
  const r = await s.rpc(nom, args, c);
  const corps = await r.json();
  return { statut: r.status, resultat: corps.resultat, erreur: corps.erreur as string | undefined };
};
const ok = async (nom: string, ...args: unknown[]) => {
  const r = await appel(nom, args);
  if (r.statut !== 200) throw new Error(`${nom} : ${r.statut} ${r.erreur}`);
  return r.resultat;
};
const envoyer = async (nom = "photo.jpg", type = "image/jpeg") => {
  const f = new FormData();
  f.append("fichier", new File([new Uint8Array([255, 216, 255])], nom, { type }));
  const r = await s.app.handle(new Request("http://local/api/fichiers", { method: "POST", body: f, headers: { "x-app": "1", cookie } }));
  return (await r.json()) as { fichier: string; nom: string };
};

describe("notes", () => {
  test("création avec pièces jointes, d'un seul tenant ; fiche complète", async () => {
    const photo = await envoyer();
    const id = await ok("creerNote", { titre: " Rendez-vous ", texte: "mardi", pieces: [photo] });
    const n = await ok("ficheNote", id);
    expect(n).toMatchObject({ titre: "Rendez-vous", texte: "mardi", archivee: false });
    expect(n.pieces).toHaveLength(1);
    expect(n.pieces[0]).toMatchObject({ nom: "photo.jpg", mime: "image/jpeg", taille: 3 });
  });

  test("contrôles : titre obligatoire, fichier inconnu ou déjà rattaché refusé, rien n'est créé", async () => {
    const avant = (await ok("listeNotes")).length;
    expect((await appel("creerNote", [{ titre: "  " }])).erreur).toBe("Le titre est obligatoire.");
    expect((await appel("creerNote", [{ titre: "X", pieces: [{ fichier: "inconnu.jpg", nom: "x" }] }])).statut).toBe(400);
    const photo = await envoyer();
    await ok("creerNote", { titre: "Première", pieces: [photo] });
    expect((await appel("creerNote", [{ titre: "Seconde", pieces: [photo] }])).erreur).toBe("Ce fichier est déjà rattaché.");
    expect((await ok("listeNotes")).length).toBe(avant + 1);
  });

  test("retirer une pièce jointe l'archive ; le journal garde la note avant / après", async () => {
    const id = await ok("creerNote", { titre: "Avec photo", pieces: [await envoyer()] });
    const [p] = (await ok("ficheNote", id)).pieces;
    await ok("retirerPiece", p.id);
    expect((await ok("ficheNote", id)).pieces[0].archive).toBe(true);
    const { lignes } = await (await s.requete(`/api/journal?cible=${id}`, { cookie })).json();
    expect(lignes.map((l: { fonction: string }) => l.fonction)).toEqual(["retirerPiece", "creerNote"]);
    expect(JSON.parse(lignes[1].apres).pieces_jointes).toHaveLength(1);
  });

  test("archivée : plus modifiable par le rôle écriture, toujours par un admin ; désarchiver réservé aux admins", async () => {
    const id = await ok("creerNote", { titre: "À archiver" });
    expect((await appel("archiverNote", [id, true], ecrivain.cookie)).statut).toBe(200);
    expect((await appel("majNote", [id, { texte: "non" }], ecrivain.cookie)).statut).toBe(403);
    expect((await appel("archiverNote", [id, false], ecrivain.cookie)).statut).toBe(403);
    expect((await appel("majNote", [id, { texte: "admin" }])).statut).toBe(200);
    expect((await ok("listeNotes", { archivees: true })).some((n: { id: string }) => n.id === id)).toBe(true);
  });
});
