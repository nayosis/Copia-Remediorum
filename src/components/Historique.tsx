import { Card, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { appelApi } from "../lib/rpc";
import { LIBELLES_FONCTIONS } from "../lib/modele";
import { DiffJournal } from "./DiffJournal";

type LigneJournal = { id: number; quand: string; utilisateur: string; fonction: string; avant: string | null; apres: string | null };

export const quand = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

/** Historique d'une fiche et des lignes qui la citent (serveur/modele.ts, LIENS_JOURNAL). Admins : le journal leur est réservé. */
export function Historique({ id }: { id: string }) {
  const { data } = useQuery({ queryKey: ["journal", "fiche", id], queryFn: () => appelApi<{ lignes: LigneJournal[] }>(`/api/journal?cible=${id}`) });
  const lignes = data?.lignes ?? [];
  return (
    <Card withBorder>
      <Title order={4} mb="xs">
        Historique
      </Title>
      <Stack gap="sm">
        {lignes.map((l) => (
          <div key={l.id}>
            <Text size="sm">
              <b>{LIBELLES_FONCTIONS[l.fonction] ?? l.fonction}</b>{" "}
              <Text span c="dimmed" size="xs">
                {quand(l.quand)} · {l.utilisateur}
              </Text>
            </Text>
            {!l.fonction.startsWith("creer") && <DiffJournal avant={l.avant} apres={l.apres} />}
          </div>
        ))}
      </Stack>
    </Card>
  );
}
