import { describe, expect, test } from "bun:test";
import { ajouterJours, aujourdhui } from "../src/lib/dates";
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

const C = 4;
const jour = aujourdhui();
const ilYA = (n: number) => ajouterJours(jour, -n);
const unParJour = { moments: { matin: C }, rythme: { type: "quotidien" } };

const jeanne = await ok("creerPersonne", { prenom: "Jeanne" });
const robert = await ok("creerPersonne", { prenom: "Robert" });
type Stock = { id: string; medicamentId: string; personneId: string | null; traitements: { prenom: string }[]; etat: Record<string, unknown> };
const stocksDe = async (medicamentId: string): Promise<Stock[]> => (await ok("listeStocks")).filter((x: Stock) => x.medicamentId === medicamentId);

describe("stocks", () => {
  test("premier traitement d'un médicament : stock partagé créé ; le second traitement y puise aussi", async () => {
    const med = await ok("creerMedicament", { nom: "Doliprane" });
    await ok("creerTraitement", { personneId: jeanne, medicamentId: med, posologie: unParJour, debut: ilYA(30) });
    await ok("creerTraitement", { personneId: robert, medicamentId: med, posologie: unParJour, debut: ilYA(30) });
    const [partage] = await stocksDe(med);
    expect(partage.personneId).toBeNull();
    expect(partage.traitements.map((t) => t.prenom).sort()).toEqual(["Jeanne", "Robert"]);
    expect(partage.etat.statut).toBe("inconnu");
  });

  test("stock propre : le traitement de sa personne y puise, les autres restent sur le partagé ; un seul par personne", async () => {
    const med = await ok("creerMedicament", { nom: "Kardégic" });
    await ok("creerTraitement", { personneId: jeanne, medicamentId: med, posologie: unParJour, debut: ilYA(30) });
    await ok("creerTraitement", { personneId: robert, medicamentId: med, posologie: unParJour, debut: ilYA(30) });
    const propre = await ok("creerStock", { medicamentId: med, personneId: robert, pointage: { date: jour, quantite: 10 * C } });
    const stocks = await stocksDe(med);
    expect(stocks.find((x) => x.id === propre)!.traitements.map((t) => t.prenom)).toEqual(["Robert"]);
    expect(stocks.find((x) => x.personneId === null)!.traitements.map((t) => t.prenom)).toEqual(["Jeanne"]);
    expect((await appel("creerStock", [{ medicamentId: med, personneId: robert }])).erreur).toBe("Cette personne a déjà son stock de ce médicament.");
    expect((await appel("creerStock", [{ medicamentId: med }])).erreur).toBe("Ce médicament a déjà un stock partagé.");
    // Stock propre archivé : Robert revient sur le stock partagé.
    await ok("archiverStock", propre, true);
    expect((await stocksDe(med))[0].traitements.length).toBe(2);
  });

  test("pointage : recale le stock estimé et la date d'épuisement ; le plus récent l'emporte", async () => {
    const med = await ok("creerMedicament", { nom: "Levothyrox" });
    await ok("creerTraitement", { personneId: jeanne, medicamentId: med, posologie: unParJour, debut: ilYA(60) });
    const [st] = await stocksDe(med);
    await ok("pointer", { stockId: st.id, date: ilYA(10), quantite: 30 * C });
    expect((await stocksDe(med))[0].etat).toMatchObject({ statut: "ok", estime: 20 * C, epuisement: ajouterJours(jour, 21) });
    // Une boîte perdue : on recompte, il en reste moins que prévu.
    await ok("pointer", { stockId: st.id, date: jour, quantite: 5 * C });
    expect((await stocksDe(med))[0].etat).toMatchObject({ statut: "alerte", estime: 5 * C, epuisement: ajouterJours(jour, 6) });
    expect((await appel("pointer", [{ stockId: st.id, date: ajouterJours(jour, 1), quantite: 4 }])).erreur).toBe("Un pointage ne peut pas être dans le futur.");
    expect((await appel("pointer", [{ stockId: st.id, date: jour, quantite: 1.5 }])).statut).toBe(400);
  });

  test("fiche : pointages du plus récent au plus ancien, avec ce que le calcul prévoyait ; historique du stock", async () => {
    const med = await ok("creerMedicament", { nom: "Aspégic" });
    await ok("creerTraitement", { personneId: robert, medicamentId: med, posologie: unParJour, debut: ilYA(60) });
    const [st] = await stocksDe(med);
    await ok("pointer", { stockId: st.id, date: ilYA(5), quantite: 20 * C });
    await ok("pointer", { stockId: st.id, date: jour, quantite: 13 * C, note: "une boîte retrouvée" });
    const f = await ok("ficheStock", st.id);
    expect(f.pointages.map((p: { quantite: number; attendu: number | null }) => [p.quantite, p.attendu])).toEqual([
      [13 * C, 15 * C],
      [20 * C, null],
    ]);
    const { lignes } = await (await s.requete(`/api/journal?cible=${st.id}`, { cookie })).json();
    expect(lignes.filter((l: { fonction: string }) => l.fonction === "pointer").length).toBe(2);
    expect(JSON.parse(lignes[0].apres).stock).toBe("Aspégic — partagé");
  });

  test("sans posologie : seul le seuil du médicament alerte", async () => {
    const med = await ok("creerMedicament", { nom: "Spasfon", seuilAlerte: 10 * C });
    await ok("creerTraitement", { personneId: robert, medicamentId: med, posologie: null, debut: ilYA(60) });
    const [st] = await stocksDe(med);
    await ok("pointer", { stockId: st.id, date: jour, quantite: 12 * C });
    expect((await stocksDe(med))[0].etat.statut).toBe("ok");
    await ok("pointer", { stockId: st.id, date: jour, quantite: 8 * C });
    expect((await stocksDe(med))[0].etat).toMatchObject({ statut: "alerte", sousSeuil: true, epuisement: null });
  });

  test("droits : le rôle écriture pointe, seul un admin corrige ou supprime un pointage", async () => {
    const med = await ok("creerMedicament", { nom: "Inexium" });
    const st = await ok("creerStock", { medicamentId: med });
    const p = (await appel("pointer", [{ stockId: st, date: jour, quantite: 8 }], ecrivain.cookie)).resultat;
    expect(typeof p).toBe("string");
    expect((await appel("majPointage", [p, { quantite: 12 }], ecrivain.cookie)).statut).toBe(403);
    expect((await appel("supprimerPointage", [p], ecrivain.cookie)).statut).toBe(403);
    expect((await appel("majPointage", [p, { quantite: 12 }])).statut).toBe(200);
    expect((await ok("ficheStock", st)).pointages[0].quantite).toBe(12);
    expect((await appel("supprimerPointage", [p])).statut).toBe(200);
  });

  test("traitement en cours sans stock signalé ; saisie rapide : libellés et estimation", async () => {
    const med = await ok("creerMedicament", { nom: "Xarelto" });
    await ok("creerTraitement", { personneId: jeanne, medicamentId: med, posologie: unParJour, debut: ilYA(5) });
    const [st] = await stocksDe(med);
    await ok("archiverStock", st.id, true);
    expect((await ok("traitementsSansStock")).map((t: { medicament: string }) => t.medicament)).toContain("Xarelto");
    await ok("archiverStock", st.id, false);
    expect((await ok("traitementsSansStock")).map((t: { medicament: string }) => t.medicament)).not.toContain("Xarelto");
    expect((await ok("stocksAPointer")).find((x: { id: string }) => x.id === st.id).libelle).toBe("Xarelto — partagé");
  });
});

describe("à renouveler", () => {
  test("par personne : un stock partagé figure chez chacune ; jamais pointés à part ; prochaines échéances", async () => {
    const paul = await ok("creerPersonne", { prenom: "Paul" });
    const lucie = await ok("creerPersonne", { prenom: "Lucie" });
    const commun = await ok("creerMedicament", { nom: "Commun" });
    const tranquille = await ok("creerMedicament", { nom: "Tranquille" });
    const jamais = await ok("creerMedicament", { nom: "Jamais compté" });
    await ok("creerTraitement", { personneId: paul, medicamentId: commun, posologie: unParJour, debut: ilYA(10) });
    await ok("creerTraitement", { personneId: lucie, medicamentId: commun, posologie: unParJour, debut: ilYA(10) });
    await ok("creerTraitement", { personneId: lucie, medicamentId: tranquille, posologie: unParJour, debut: ilYA(10) });
    await ok("creerTraitement", { personneId: paul, medicamentId: jamais, posologie: unParJour, debut: ilYA(10) });
    const [stCommun] = await stocksDe(commun);
    const [stTranquille] = await stocksDe(tranquille);
    await ok("pointer", { stockId: stCommun.id, date: jour, quantite: 6 * C }); // 2 par jour : 3 jours
    await ok("pointer", { stockId: stTranquille.id, date: jour, quantite: 60 * C });

    const r = await ok("aRenouveler");
    const de = (prenom: string) => r.parPersonne.find((p: { prenom: string }) => p.prenom === prenom)?.lignes ?? [];
    expect(de("Paul").map((l: { medicament: string; partageAvec: string[] }) => [l.medicament, l.partageAvec])).toEqual([["Commun", ["Lucie"]]]);
    expect(de("Lucie").map((l: { medicament: string }) => l.medicament)).toEqual(["Commun"]);
    expect(r.aPointer.map((s: { medicament: string }) => s.medicament)).toContain("Jamais compté");
    expect(r.prochaines.map((s: { medicament: string }) => s.medicament)).toContain("Tranquille");
  });
});
