import { Alert, Badge, Button, Card, Group, Stack, Table, Text, ThemeIcon, Title, UnstyledButton } from "@mantine/core";
import { IconAdjustmentsHorizontal, IconCircleCheck, IconPill, IconPrinter } from "@tabler/icons-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { aRenouveler, listeStocks } from "../data/stocks";
import { AvisMiseAJour } from "../components/MiseAJour";
import { BadgeStatut, STATUTS, echeanceLisible } from "../components/Statut";
import { dateLisible } from "../lib/dates";
import { useEcran } from "../lib/ecran";
import { posologieLisible } from "../lib/posologie";
import { quantiteAvecUnite } from "../lib/quantites";
import { useSaisieRapide } from "../lib/saisie";
import { peutEcrire } from "../lib/session";

type Donnees = Awaited<ReturnType<typeof aRenouveler>>;

/** « Mardi 27 octobre 2026 ». */
export function aujourdhuiLong() {
  const t = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Premier lancement : rien n'est encore saisi. */
export function Bienvenue() {
  const { telephone } = useEcran();
  return (
    <Card withBorder padding="lg">
      <Group align="flex-start" wrap="nowrap">
        <ThemeIcon size={44} radius="md" variant="light">
          <IconPill size={26} />
        </ThemeIcon>
        <Stack gap={4}>
          <Text fw={600}>Bienvenue dans Copia Remediorum</Text>
          <Text size="sm" c="dimmed">
            Pour commencer : ajoutez les personnes suivies dans les Paramètres, puis leurs traitements avec la posologie. Il suffira ensuite de compter
            les boîtes de temps en temps : cette page dira quand demander l'ordonnance.
          </Text>
          {peutEcrire() && !telephone && (
            <Button component={Link} to="/parametres" mt="sm" leftSection={<IconAdjustmentsHorizontal size={16} />} w="fit-content">
              Ouvrir les paramètres
            </Button>
          )}
        </Stack>
      </Group>
    </Card>
  );
}

/** Une personne et ce qu'il faut lui faire renouveler : la liste à dicter au médecin. */
function CartePersonne({ p, jour }: { p: Donnees["parPersonne"][number]; jour: string }) {
  const { telephone } = useEcran();
  const naviguer = useNavigate();
  return (
    <Card withBorder className="carte-renouveler">
      <Title order={3} mb="xs">
        {p.prenom}
      </Title>
      <Table highlightOnHover>
        <Table.Tbody>
          {p.lignes.map((l) => (
            <Table.Tr key={l.stockId} className="ligne-cliquable" onClick={() => naviguer({ to: "/stocks/$id", params: { id: l.stockId } })}>
              <Table.Td>
                <Text fw={600}>{l.medicament}</Text>
                <Text size="xs" c="dimmed">
                  {posologieLisible(l.posologie)}
                  {l.partageAvec.length ? ` · stock partagé avec ${l.partageAvec.join(", ")}` : ""}
                </Text>
                {telephone && <Text size="sm">{echeanceLisible(l.etat, jour)}</Text>}
              </Table.Td>
              {!telephone && (
                <Table.Td>
                  <Text size="sm">{echeanceLisible(l.etat, jour)}</Text>
                  <Text size="xs" c="dimmed">
                    Ce soir : {l.etat.estime === null ? "—" : quantiteAvecUnite(l.etat.estime, l.unite)}
                  </Text>
                </Table.Td>
              )}
              <Table.Td w={telephone ? undefined : 130} ta="right">
                <BadgeStatut etat={l.etat} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}

/**
 * « Ce soir, dans l'armoire » : tous les stocks actifs, le stock estimé ce soir (après les prises du jour) et jusqu'à
 * quand il tient. Pris si besoin : le dernier comptage (≈). Pas à l'impression (la liste imprimée va au médecin).
 */
function CarteCeSoir({ jour }: { jour: string }) {
  const { telephone } = useEcran();
  const naviguer = useNavigate();
  const { data: stocks } = useQuery({ queryKey: ["stocks", false], queryFn: () => listeStocks() });
  if (!stocks?.length) return null;
  const ouvrir = (id: string) => naviguer({ to: "/stocks/$id", params: { id } });
  const ligne = (s: (typeof stocks)[number]) => {
    const enCours = s.traitements.filter((t) => !t.fin || t.fin >= jour);
    const siBesoin = !enCours.some((t) => t.posologie);
    const quantite = s.etat.estime === null ? "—" : `${siBesoin ? "≈ " : ""}${quantiteAvecUnite(s.etat.estime, s.unite)}`;
    const tient =
      s.etat.statut === "inconnu" ? (
        <Text size="sm" c="dimmed">
          À pointer
        </Text>
      ) : siBesoin || !s.etat.epuisement ? (
        <Text size="sm" c="dimmed">
          {siBesoin ? "Si besoin" : "—"}
        </Text>
      ) : (
        <Badge color={STATUTS[s.etat.statut].couleur} variant="light">
          {dateLisible(s.etat.epuisement, { day: "numeric", month: "short" })}
        </Badge>
      );
    return { quantite, tient };
  };
  return (
    <Card withBorder className="pas-a-l-impression">
      <Group justify="space-between" align="baseline" mb="xs">
        <Title order={4}>Ce soir, dans l'armoire</Title>
        <Text size="xs" c="dimmed">
          estimé après les prises du jour
        </Text>
      </Group>
      {telephone ? (
        <Stack gap={6}>
          {stocks.map((s) => {
            const l = ligne(s);
            return (
              <UnstyledButton key={s.id} onClick={() => ouvrir(s.id)}>
                <Group justify="space-between" wrap="nowrap">
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={600} truncate>
                      {s.medicament}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {s.prenom ?? "Partagé"} · {l.quantite}
                    </Text>
                  </div>
                  {l.tient}
                </Group>
              </UnstyledButton>
            );
          })}
        </Stack>
      ) : (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Médicament</Table.Th>
              <Table.Th>Boîtes de</Table.Th>
              <Table.Th ta="right">Ce soir</Table.Th>
              <Table.Th ta="right">Tient jusqu'au</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {stocks.map((s) => {
              const l = ligne(s);
              return (
                <Table.Tr key={s.id} className="ligne-cliquable" onClick={() => ouvrir(s.id)}>
                  <Table.Td fw={500}>{s.medicament}</Table.Td>
                  <Table.Td>{s.prenom ?? "Partagé"}</Table.Td>
                  <Table.Td ta="right" fw={600} style={{ whiteSpace: "nowrap" }}>
                    {l.quantite}
                  </Table.Td>
                  <Table.Td ta="right">{l.tient}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </Card>
  );
}

/** Accueil : ce qu'il faut faire renouveler, par personne ; les stocks à pointer ; les prochaines échéances. */
export function Accueil() {
  const { telephone } = useEcran();
  const naviguer = useNavigate();
  const pointerStock = useSaisieRapide();
  const { data: d } = useQuery({ queryKey: ["aRenouveler"], queryFn: () => aRenouveler() });
  if (!d) return null;
  const rien = d.parPersonne.length === 0 && d.autres.length === 0;

  return (
    <Stack p={telephone ? "md" : "xl"} gap="lg" maw={1100}>
      <AvisMiseAJour />
      <Group justify="space-between">
        <div>
          <Title order={2}>À renouveler</Title>
          <Text c="dimmed" size="sm">
            {aujourdhuiLong()}
          </Text>
        </div>
        {!telephone && (
          <Group gap="xs" className="pas-a-l-impression">
            {!rien && (
              <Button variant="default" leftSection={<IconPrinter size={16} />} onClick={() => window.print()}>
                Imprimer
              </Button>
            )}
            {peutEcrire() && pointerStock && <Button onClick={() => pointerStock()}>Pointer / Réappro.</Button>}
          </Group>
        )}
      </Group>

      {d.nbPersonnes === 0 && <Bienvenue />}

      {d.nbPersonnes > 0 && rien && (
        <Card withBorder padding="lg">
          <Group wrap="nowrap">
            <ThemeIcon size={40} radius="xl" color="marque" variant="light">
              <IconCircleCheck size={24} />
            </ThemeIcon>
            <div>
              <Text fw={600}>Rien à renouveler pour l'instant</Text>
              <Text size="sm" c="dimmed">
                {d.prochaines[0]
                  ? `Prochaine échéance : ${d.prochaines[0].medicament}, à renouveler à partir du ${dateLisible(d.prochaines[0].etat.alerteLe)}.`
                  : "Aucune échéance calculée : pointez les stocks pour lancer le calcul."}
              </Text>
            </div>
          </Group>
        </Card>
      )}

      {d.parPersonne.map((p) => (
        <CartePersonne key={p.id} p={p} jour={d.jour} />
      ))}

      {d.autres.map((s) => (
        <Alert key={s.id} color="orange" title={`${s.medicament} (${s.prenom ?? "partagé"})`}>
          {echeanceLisible(s.etat, d.jour)} — aucun traitement en cours n'y puise.
        </Alert>
      ))}

      {d.nbPersonnes > 0 && <CarteCeSoir jour={d.jour} />}

      {d.aPointer.length > 0 && (
        <Card withBorder className="pas-a-l-impression">
          <Title order={4} mb={4}>
            À pointer
          </Title>
          <Text size="sm" c="dimmed" mb="xs">
            Jamais comptés : sans pointage, pas de calcul.
          </Text>
          <Group gap="xs">
            {d.aPointer.map((s) => (
              <Button key={s.id} size="xs" variant="light" onClick={() => (pointerStock && peutEcrire() ? pointerStock(s.id) : naviguer({ to: "/stocks/$id", params: { id: s.id } }))}>
                {s.medicament} — {s.prenom ?? "partagé"}
              </Button>
            ))}
          </Group>
        </Card>
      )}

      {d.prochaines.length > 0 && (
        <Card withBorder className="pas-a-l-impression">
          <Title order={4} mb="xs">
            Prochaines échéances
          </Title>
          <Stack gap={6}>
            {d.prochaines.map((s) => (
              <UnstyledButton key={s.id} onClick={() => naviguer({ to: "/stocks/$id", params: { id: s.id } })}>
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm">
                    <b>{s.medicament}</b> <Text span c="dimmed">({s.prenom ?? "partagé"})</Text>
                  </Text>
                  <Text size="sm" c="dimmed" ta="right">
                    à renouveler à partir du {dateLisible(s.etat.alerteLe, { day: "numeric", month: "long" })}
                  </Text>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
