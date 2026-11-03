import { describe, expect, test } from "bun:test";
import { FONCTIONS, NOMS_MODULES_RPC } from "../serveur/rpc";
import { SUPER, serveurDeTest } from "./outils-serveur";

const s = await serveurDeTest();
const { cookie } = await s.connexion(SUPER.email, SUPER.motDePasse);

describe("RPC", () => {
  test("modules de src/data/ exposés, sauf _*.ts ; lectures et écritures repérées", () => {
    expect(NOMS_MODULES_RPC).toContain("referentiel");
    expect(NOMS_MODULES_RPC.some((m) => m.startsWith("_"))).toBe(false);
    expect(FONCTIONS.has("delaiAlerteGeneral")).toBe(false);
    expect(FONCTIONS.has("verifierVersion")).toBe(false);
    expect(FONCTIONS.get("listePersonnes")?.droit).toBe("lecture");
    expect(FONCTIONS.get("creerPersonne")?.droit).toBe("ecriture");
  });

  test("écriture puis lecture ; écritures journalisées, avec qui et quand", async () => {
    const r = await s.rpc("creerPersonne", [{ prenom: "  Jeanne  " }], cookie);
    expect(r.status).toBe(200);
    const { resultat: id } = await r.json();
    expect(typeof id).toBe("string");
    const liste = await (await s.rpc("listePersonnes", [], cookie)).json();
    expect(liste.resultat.find((n: { id: string }) => n.id === id)).toMatchObject({ prenom: "Jeanne", creePar: SUPER.email });
    const journal = await (await s.requete("/api/journal", { cookie })).json();
    expect(journal.lignes[0]).toMatchObject({ fonction: "creerPersonne", cible: id, utilisateur: SUPER.email });
  });

  test("conflit : version périmée modifiée par quelqu'un d'autre refusée", async () => {
    const autre = await s.compte("autre@famille.fr", "ecriture");
    const id = (await (await s.rpc("creerPersonne", [{ prenom: "Robert" }], cookie)).json()).resultat;
    const { resultat: v1 } = await (await s.rpc("majPersonne", [id, { prenom: "Rob" }], cookie)).json();
    // La version est l'heure à la milliseconde : deux écritures dans la même milliseconde se confondraient.
    await Bun.sleep(5);
    expect((await s.rpc("majPersonne", [id, { prenom: "Bob" }, v1.modifieLe], autre.cookie)).status).toBe(200);
    expect((await s.rpc("majPersonne", [id, { prenom: "Roby" }, v1.modifieLe], cookie)).status).toBe(409);
  });

  test("fonction inconnue ou réservée au serveur : 404 ; arguments invalides : 422", async () => {
    expect((await s.rpc("dropTable", [], cookie)).status).toBe(404);
    expect((await s.rpc("sansTrace", [{}], cookie)).status).toBe(404);
    expect((await s.requete("/api/rpc/listeNotes", { corps: {}, cookie })).status).toBe(422);
  });
});
