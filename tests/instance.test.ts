import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verrouillerDossier } from "../serveur/base";

test("un seul serveur par dossier de données : le second refuse de démarrer", async () => {
  const dossier = mkdtempSync(join(tmpdir(), "fundamentum-verrou-"));
  verrouillerDossier(dossier);
  const base = join(import.meta.dir, "..", "serveur", "base.ts").replace(/\\/g, "/");
  const second = Bun.spawn(["bun", "-e", `import { verrouillerDossier } from "${base}"; verrouillerDossier(${JSON.stringify(dossier)});`], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(await second.exited).not.toBe(0);
  expect(await new Response(second.stderr).text()).toContain("Un autre serveur Fundamentum utilise déjà ce dossier");
}, 20_000);
