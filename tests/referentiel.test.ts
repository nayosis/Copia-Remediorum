import { describe, expect, test } from "bun:test";
import { SUPER, serveurDeTest } from "./outils-serveur";

const s = await serveurDeTest();
const { cookie } = await s.connexion(SUPER.email, SUPER.motDePasse);
const ecrivain = await s.compte("ecriture@famille.fr", "ecriture");
const lecteur = await s.compte("lecture@famille.fr", "lecture");

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

const jeanne = await ok("creerPersonne", { prenom: " Jeanne " });
const robert = await ok("creerPersonne", { prenom: "Robert" });

describe("personnes et médicaments", () => {
  test("personnes dans l'ordre de création ; archivées masquées", async () => {
    const id = await ok("creerPersonne", { prenom: "Tante Lucie" });
    expect((await ok("listePersonnes")).map((p: { prenom: string }) => p.prenom)).toEqual(["Jeanne", "Robert", "Tante Lucie"]);
    await ok("archiverPersonne", id, true);
    expect((await ok("listePersonnes")).length).toBe(2);
    expect((await ok("listePersonnes", { archivees: true })).length).toBe(3);
    expect((await appel("creerPersonne", [{ prenom: " " }])).erreur).toBe("Le prénom est obligatoire.");
  });

  test("médicament : unité par défaut, nom unique (sans tenir compte des majuscules), seuil en quarts", async () => {
    const id = await ok("creerMedicament", { nom: "Kardégic 75 mg" });
    expect((await ok("listeMedicaments")).find((m: { id: string }) => m.id === id)).toMatchObject({ unite: "comprimé", seuilAlerte: null, traitementsEnCours: 0 });
    expect((await appel("creerMedicament", [{ nom: "kardégic 75 MG" }])).erreur).toBe("« kardégic 75 MG » existe déjà.");
    await ok("majMedicament", id, { seuilAlerte: 40 });
    expect((await appel("majMedicament", [id, { seuilAlerte: -1 }])).statut).toBe(400);
  });

  test("délai d'alerte général : 7 jours par défaut, modifiable, borné", async () => {
    expect(await ok("lireParametres")).toEqual({ delaiAlerte: 7 });
    await ok("majParametres", { delaiAlerte: 10 });
    expect(await ok("lireParametres")).toEqual({ delaiAlerte: 10 });
    expect((await appel("majParametres", [{ delaiAlerte: 500 }])).statut).toBe(400);
    await ok("majParametres", { delaiAlerte: 7 });
  });
});

const doliprane = await ok("creerMedicament", { nom: "Doliprane 1000 mg" });

describe("traitements", () => {
  const posologie = { moments: { matin: 4, soir: 2 }, rythme: { type: "quotidien" } };

  test("création, lecture avec la posologie, journal avec personne et médicament", async () => {
    const id = await ok("creerTraitement", { personneId: jeanne, medicamentId: doliprane, posologie, debut: "2026-10-01" });
    const [t] = (await ok("listeTraitements", { personneId: jeanne })).filter((x: { id: string }) => x.id === id);
    expect(t).toMatchObject({ prenom: "Jeanne", medicament: "Doliprane 1000 mg", posologie, fin: null, delaiAlerte: null });
    const { lignes } = await (await s.requete(`/api/journal?cible=${id}`, { cookie })).json();
    expect(JSON.parse(lignes[0].apres)).toMatchObject({ personne: "Jeanne", medicament: "Doliprane 1000 mg" });
  });

  test("sans posologie, délai d'alerte propre ; contrôles", async () => {
    const id = await ok("creerTraitement", { personneId: robert, medicamentId: doliprane, posologie: null, debut: "2026-10-01", delaiAlerte: 14 });
    expect((await ok("listeTraitements", { personneId: robert }))[0]).toMatchObject({ id, posologie: null, delaiAlerte: 14 });
    const base = { personneId: robert, medicamentId: doliprane, debut: "2026-10-01" };
    expect((await appel("creerTraitement", [{ ...base, posologie: { moments: {}, rythme: { type: "quotidien" } } }])).statut).toBe(400);
    expect((await appel("creerTraitement", [{ ...base, posologie, fin: "2026-09-01" }])).erreur).toBe("La date de fin précède la date de début.");
    expect((await appel("creerTraitement", [{ ...base, posologie, personneId: "inconnue" }])).statut).toBe(404);
    expect((await appel("creerTraitement", [{ ...base, posologie, delaiAlerte: 1.5 }])).statut).toBe(400);
  });

  test("arrêt (date de fin passée) : masqué des traitements en cours, visible avec les terminés", async () => {
    const id = await ok("creerTraitement", { personneId: jeanne, medicamentId: doliprane, posologie, debut: "2026-01-01" });
    const [t] = (await ok("listeTraitements", { termines: true })).filter((x: { id: string }) => x.id === id);
    await ok("majTraitement", id, { fin: "2026-02-01" }, t.modifieLe);
    expect((await ok("listeTraitements")).some((x: { id: string }) => x.id === id)).toBe(false);
    expect((await ok("listeTraitements", { termines: true })).some((x: { id: string }) => x.id === id)).toBe(true);
  });

  test("droits : lecture seule pour le rôle lecture ; suppression réservée aux admins", async () => {
    const id = await ok("creerTraitement", { personneId: jeanne, medicamentId: doliprane, posologie, debut: "2026-10-01" });
    expect((await appel("listeTraitements", [], lecteur.cookie)).statut).toBe(200);
    expect((await appel("majTraitement", [id, { note: "x" }], lecteur.cookie)).statut).toBe(403);
    expect((await appel("majTraitement", [id, { note: "Dr Martin" }], ecrivain.cookie)).statut).toBe(200);
    expect((await appel("supprimerTraitement", [id], ecrivain.cookie)).statut).toBe(403);
    expect((await appel("supprimerTraitement", [id])).statut).toBe(200);
  });
});
