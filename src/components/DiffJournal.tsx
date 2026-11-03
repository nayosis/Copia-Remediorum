import { Code, Group, Stack, Text } from "@mantine/core";
import { euros } from "../lib/montants";
import { CHAMPS_BOOLEENS, CHAMPS_FICHIERS, CHAMPS_IGNORES, CHAMPS_MONTANTS, LIBELLES_CHAMPS, lisibleMetier } from "../lib/modele";

type Fiche = Record<string, unknown>;

function lisible(cle: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const metier = lisibleMetier(cle, v);
  if (metier !== null) return metier;
  if (CHAMPS_MONTANTS.has(cle) && typeof v === "number") return euros(v);
  if (CHAMPS_BOOLEENS.has(cle)) return v ? "oui" : "non";
  if (CHAMPS_FICHIERS.has(cle) && Array.isArray(v)) {
    const actifs = (v as { nom: string; archive: number }[]).filter((j) => !j.archive);
    return actifs.map((j) => j.nom).join(", ") || "aucune";
  }
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) return v.join(", ") || "—";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

const lire = (json: string | null): Fiche | null => (json ? (JSON.parse(json) as Fiche) : null);

/**
 * Ce qu'une écriture a changé : création (la fiche), suppression (ce qu'elle était), sinon les seuls champs modifiés,
 * ancienne valeur → nouvelle.
 */
export function DiffJournal({ avant: a, apres: b }: { avant: string | null; apres: string | null }) {
  const avant = lire(a);
  const apres = lire(b);
  if (!avant && !apres) return null;
  const cles = [...new Set([...Object.keys(avant ?? {}), ...Object.keys(apres ?? {})])].filter((k) => !CHAMPS_IGNORES.has(k) && !k.endsWith("_id"));
  const lignes = cles
    .map((k) => ({ k, av: lisible(k, avant?.[k]), ap: lisible(k, apres?.[k]) }))
    .filter((l) => !avant || !apres || l.av !== l.ap)
    .filter((l) => (avant && apres) || (avant ? l.av : l.ap) !== "—");
  if (lignes.length === 0)
    return (
      <Text size="xs" c="dimmed">
        Aucun champ changé.
      </Text>
    );
  return (
    <Stack gap={2}>
      {lignes.map(({ k, av, ap }) => (
        <Group key={k} gap={6} wrap="nowrap" align="baseline">
          <Text size="xs" c="dimmed" w={110} style={{ flexShrink: 0 }}>
            {LIBELLES_CHAMPS[k] ?? k}
          </Text>
          {avant && apres ? (
            <Text size="xs">
              <Code fz="xs" c="red.8" bg="red.0" style={{ textDecoration: "line-through" }}>
                {av}
              </Code>{" "}
              →{" "}
              <Code fz="xs" c="green.9" bg="green.0">
                {ap}
              </Code>
            </Text>
          ) : (
            <Text size="xs" td={apres ? undefined : "line-through"}>
              {apres ? ap : av}
            </Text>
          )}
        </Group>
      ))}
    </Stack>
  );
}
