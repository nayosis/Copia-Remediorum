import { describe, expect, test } from "bun:test";
import { erreurPosologie, moyenneParJour, posologieLisible, priseDuJour, type Posologie } from "../src/lib/posologie";
import { quantiteAvecUnite, quantiteLisible, versQuarts } from "../src/lib/quantites";
import { ajouterJours, ecartJours, jourSemaine } from "../src/lib/dates";

const quotidien = (moments: Posologie["moments"]): Posologie => ({ moments, rythme: { type: "quotidien" } });

describe("quantités en quarts", () => {
  test("affichage et saisie", () => {
    expect(quantiteLisible(6)).toBe("1 ½");
    expect(quantiteLisible(2)).toBe("½");
    expect(quantiteLisible(1)).toBe("¼");
    expect(quantiteLisible(12)).toBe("3");
    expect(quantiteLisible(0)).toBe("0");
    expect(quantiteAvecUnite(48, "comprimé")).toBe("12 comprimés");
    expect(quantiteAvecUnite(2, "comprimé")).toBe("½ comprimé");
    expect(quantiteAvecUnite(8, "gélule")).toBe("2 gélules");
    expect(versQuarts("12,5")).toBe(50);
    expect(versQuarts(0.25)).toBe(1);
    expect(versQuarts(0.3)).toBeNull();
    expect(versQuarts(-1)).toBeNull();
  });
});

describe("dates", () => {
  test("jours ajoutés, écarts, jour de la semaine (passage à l'heure d'hiver compris)", () => {
    expect(ajouterJours("2026-10-24", 2)).toBe("2026-10-26");
    expect(ajouterJours("2026-03-01", -1)).toBe("2026-02-28");
    expect(ecartJours("2026-10-24", "2026-11-03")).toBe(10);
    expect(jourSemaine("2026-11-02")).toBe(1);
    expect(jourSemaine("2026-11-08")).toBe(7);
  });
});

describe("posologie", () => {
  const periode = { debut: "2026-11-01", fin: "2026-11-30" };

  test("prise du jour : moments additionnés, quarts", () => {
    const p = quotidien({ matin: 4, soir: 2 });
    expect(priseDuJour(p, periode, "2026-11-10")).toBe(6);
    expect(moyenneParJour(p)).toBe(6);
    expect(posologieLisible(p)).toBe("1 matin, ½ soir · tous les jours");
  });

  test("hors des dates du traitement, sans posologie : rien", () => {
    const p = quotidien({ matin: 4 });
    expect(priseDuJour(p, periode, "2026-10-31")).toBe(0);
    expect(priseDuJour(p, periode, "2026-12-01")).toBe(0);
    expect(priseDuJour(p, { debut: "2026-11-01", fin: null }, "2030-01-01")).toBe(4);
    expect(priseDuJour(null, periode, "2026-11-10")).toBe(0);
    expect(posologieLisible(null)).toBe("Sans posologie (si besoin)");
  });

  test("un jour sur N, à partir du début", () => {
    const p: Posologie = { moments: { matin: 4 }, rythme: { type: "tous_les", jours: 2 } };
    expect(priseDuJour(p, periode, "2026-11-01")).toBe(4);
    expect(priseDuJour(p, periode, "2026-11-02")).toBe(0);
    expect(priseDuJour(p, periode, "2026-11-03")).toBe(4);
    expect(moyenneParJour(p)).toBe(2);
    expect(posologieLisible(p)).toBe("1 matin · un jour sur deux");
  });

  test("certains jours de la semaine", () => {
    const p: Posologie = { moments: { coucher: 1 }, rythme: { type: "semaine", jours: [1, 4] } };
    expect(priseDuJour(p, periode, "2026-11-02")).toBe(1); // lundi
    expect(priseDuJour(p, periode, "2026-11-03")).toBe(0);
    expect(priseDuJour(p, periode, "2026-11-05")).toBe(1); // jeudi
    expect(posologieLisible(p)).toBe("¼ coucher · lundi, jeudi");
  });

  test("contrôles", () => {
    expect(erreurPosologie(quotidien({}))).toContain("au moins une prise");
    expect(erreurPosologie(quotidien({ matin: 1.5 }))).toContain("Quantité invalide");
    expect(erreurPosologie({ moments: { matin: 4 }, rythme: { type: "tous_les", jours: 1 } })).toContain("Rythme invalide");
    expect(erreurPosologie({ moments: { matin: 4 }, rythme: { type: "semaine", jours: [] } })).toContain("au moins un jour");
    expect(erreurPosologie(quotidien({ matin: 4 }))).toBeNull();
  });
});
