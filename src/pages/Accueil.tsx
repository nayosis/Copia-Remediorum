import type { ReactNode } from "react";
import { Button, Card, Group, SimpleGrid, Stack, Table, Text, Title, UnstyledButton } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { accueil } from "../data/notes";
import { AvisMiseAJour } from "../components/MiseAJour";
import { dateLisible } from "../lib/dates";
import { useEcran } from "../lib/ecran";
import { useNouvelleNote } from "../lib/saisie";
import { peutEcrire } from "../lib/session";

/** « Mardi 27 octobre 2026 ». */
function aujourdhuiLong() {
  const t = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Chiffre clé, cliquable : libellé, valeur, précision. `accent` : la tuile principale. */
export function Tuile({ label, valeur, detail, onClick, accent }: { label: string; valeur: ReactNode; detail?: ReactNode; onClick?: () => void; accent?: boolean }) {
  const contenu = (
    <Card withBorder={!accent} padding="md" bg={accent ? "marque.6" : undefined} className={onClick ? "tuile" : undefined} h="100%">
      <Text size="sm" c={accent ? "marque.0" : "dimmed"}>
        {label}
      </Text>
      <Text fz={28} fw={700} lh={1.2} mt={4} c={accent ? "white" : undefined}>
        {valeur}
      </Text>
      {detail && (
        <Text size="xs" c={accent ? "marque.0" : "dimmed"} mt={2} truncate>
          {detail}
        </Text>
      )}
    </Card>
  );
  return onClick ? (
    <UnstyledButton onClick={onClick} style={{ display: "block" }}>
      {contenu}
    </UnstyledButton>
  ) : (
    contenu
  );
}

/** EXEMPLE — accueil : chiffres clés cliquables et dernières fiches. À remplacer par le tableau de bord de l'application. */
export function Accueil() {
  const { telephone } = useEcran();
  const naviguer = useNavigate();
  const nouvelle = useNouvelleNote();
  const { data: a } = useQuery({ queryKey: ["accueil"], queryFn: () => accueil() });

  return (
    <Stack p={telephone ? "md" : "xl"} gap="lg" maw={1200}>
      <AvisMiseAJour />
      <Group justify="space-between">
        <div>
          <Title order={2}>Accueil</Title>
          <Text c="dimmed" size="sm">
            {aujourdhuiLong()}
          </Text>
        </div>
        {peutEcrire() && !telephone && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => nouvelle()}>
            Nouvelle note
          </Button>
        )}
      </Group>
      {a && (
        <>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Tuile accent label="Notes" valeur={a.actives} detail={`${a.pieces} pièce${a.pieces > 1 ? "s" : ""} jointe${a.pieces > 1 ? "s" : ""}`} onClick={() => naviguer({ to: "/notes" })} />
            <Tuile label="Archivées" valeur={a.archivees} onClick={() => naviguer({ to: "/notes", search: { archivees: true } })} />
          </SimpleGrid>
          <Card withBorder padding="md">
            <Title order={4} mb="sm">
              Dernières notes
            </Title>
            {a.dernieres.length === 0 ? (
              <Text size="sm" c="dimmed">
                Aucune note pour l'instant.
              </Text>
            ) : (
              <Table highlightOnHover>
                <Table.Tbody>
                  {a.dernieres.map((n) => (
                    <Table.Tr key={n.id} className="ligne-cliquable" onClick={() => naviguer({ to: "/notes/$id", params: { id: n.id } })}>
                      <Table.Td>{n.titre}</Table.Td>
                      <Table.Td c="dimmed" ta="right">
                        {n.modifieLe ? dateLisible(n.modifieLe.slice(0, 10)) : ""}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>
        </>
      )}
    </Stack>
  );
}
