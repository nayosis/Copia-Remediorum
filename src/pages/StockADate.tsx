import { useState } from "react";
import { Badge, Button, Card, Group, Stack, Table, Text, Title, UnstyledButton } from "@mantine/core";
import { IconPrinter } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { stockADate } from "../data/stocks";
import { ChampDate } from "../components/Champs";
import { ajouterJours, aujourdhui, dateLisible, ecartJours } from "../lib/dates";
import { useEcran } from "../lib/ecran";
import { quantiteAvecUnite, quantiteLisible } from "../lib/quantites";

type Ligne = Awaited<ReturnType<typeof stockADate>>["lignes"][number];

/** « 57 sachets » en rouge, « Couvert (+15) » en vert, ou pourquoi il n'y a pas de calcul. */
function Manque({ l }: { l: Ligne }) {
  if (l.estime === null)
    return (
      <Text size="sm" c="dimmed">
        À pointer
      </Text>
    );
  if (l.manque === null)
    return (
      <Text size="sm" c="dimmed">
        Si besoin
      </Text>
    );
  if (l.manque > 0)
    return (
      <Badge color="red" variant="light" size="lg">
        {quantiteAvecUnite(l.manque, l.unite)}
      </Badge>
    );
  return (
    <Badge color="marque" variant="light" size="lg">
      Couvert (+{quantiteLisible(l.reste ?? 0)})
    </Badge>
  );
}

/**
 * « Stock à date » : pour tenir jusqu'au soir d'une date choisie, ce qu'il manque dans chaque stock (renouveler juste
 * ce qu'il faut). La date n'est pas retenue en quittant la page. Imprimable.
 */
export function StockADate() {
  const { telephone } = useEcran();
  const naviguer = useNavigate();
  const [jusquau, setJusquau] = useState<string | null>(ajouterJours(aujourdhui(), 30));
  const valide = !!jusquau && jusquau >= aujourdhui();
  const { data: d, error } = useQuery({ queryKey: ["stockADate", jusquau], queryFn: () => stockADate({ jusquau: jusquau! }), enabled: valide });
  const ouvrir = (id: string) => naviguer({ to: "/stocks/$id", params: { id } });
  const pour = (l: Ligne) => (l.prenom ? l.prenom : `Partagé : ${l.pour.join(", ")}`);
  const quantite = (l: Ligne, q: number | null) => (q === null ? "—" : `${l.manque === null ? "≈ " : ""}${quantiteLisible(q)}`);

  return (
    <Stack p={telephone ? "md" : "xl"} gap="md" maw={1100}>
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Stock à date</Title>
          <Text c="dimmed" size="sm">
            Ce qu'il faut faire renouveler pour tenir jusqu'à une date, sans marge.
          </Text>
        </div>
        {!telephone && d && d.lignes.length > 0 && (
          <Button variant="default" leftSection={<IconPrinter size={16} />} onClick={() => window.print()} className="pas-a-l-impression">
            Imprimer
          </Button>
        )}
      </Group>

      <Group align="flex-end" gap="sm">
        <ChampDate label="Tenir jusqu'au soir du" required value={jusquau} onChange={setJusquau} minDate={aujourdhui()} />
        {valide && (
          <Text size="sm" c="dimmed" pb={8}>
            {jusquau === aujourdhui() ? "aujourd'hui" : `dans ${ecartJours(aujourdhui(), jusquau!)} jours`}
          </Text>
        )}
      </Group>

      {error && <Text c="red">{error.message}</Text>}
      {d && d.lignes.length === 0 && <Text c="dimmed">Aucun traitement en cours : rien à prévoir.</Text>}

      {d && d.lignes.length > 0 && (
        <Card withBorder>
          {telephone ? (
            <Stack gap="xs">
              {d.lignes.map((l) => (
                <UnstyledButton key={l.stockId} onClick={() => ouvrir(l.stockId)}>
                  <Group justify="space-between" wrap="nowrap">
                    <div style={{ minWidth: 0 }}>
                      <Text fw={600} truncate>
                        {l.medicament}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {pour(l)} · ce soir {quantite(l, l.estime)}
                        {l.besoin !== null ? ` · besoin ${quantiteLisible(l.besoin)}` : ""}
                      </Text>
                    </div>
                    <Manque l={l} />
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          ) : (
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Médicament</Table.Th>
                  <Table.Th>Pour</Table.Th>
                  <Table.Th ta="right">Ce soir</Table.Th>
                  <Table.Th ta="right">Besoin d'ici là</Table.Th>
                  <Table.Th ta="right">Il manque</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {d.lignes.map((l) => (
                  <Table.Tr key={l.stockId} className="ligne-cliquable" onClick={() => ouvrir(l.stockId)}>
                    <Table.Td fw={500}>{l.medicament}</Table.Td>
                    <Table.Td>{pour(l)}</Table.Td>
                    <Table.Td ta="right">{quantite(l, l.estime)}</Table.Td>
                    <Table.Td ta="right">{l.besoin === null ? "—" : quantiteLisible(l.besoin)}</Table.Td>
                    <Table.Td ta="right">
                      <Manque l={l} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
          <Text size="xs" c="dimmed" mt="sm">
            Besoin : prises prévues du lendemain jusqu'au soir du {dateLisible(d.jusquau)} inclus. Il manque : besoin moins le stock estimé ce soir
            ({dateLisible(d.jour)}).
          </Text>
        </Card>
      )}
    </Stack>
  );
}
