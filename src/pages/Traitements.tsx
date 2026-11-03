import { useState } from "react";
import { ActionIcon, Badge, Button, Card, Group, Menu, Stack, Switch, Table, Text, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconDots, IconPencil, IconPlayerStop, IconPlus, IconTrash } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { listeTraitements, majTraitement, supprimerTraitement } from "../data/traitements";
import { listePersonnes } from "../data/referentiel";
import { ModalTraitement } from "../components/ModalTraitement";
import { aujourdhui, dateLisible } from "../lib/dates";
import { useEcran } from "../lib/ecran";
import { posologieLisible } from "../lib/posologie";
import { ecrire } from "../lib/query";
import { estAdmin, peutEcrire } from "../lib/session";

type Ligne = Awaited<ReturnType<typeof listeTraitements>>[number];

const periode = (t: Ligne) => (t.fin ? `du ${dateLisible(t.debut)} au ${dateLisible(t.fin)}` : `depuis le ${dateLisible(t.debut)}`);

/** Traitements par personne. Consultation partout ; saisie sur ordinateur ou tablette. */
export function Traitements() {
  const { telephone } = useEcran();
  const [termines, setTermines] = useState(false);
  const [edition, setEdition] = useState<{ traitement: Ligne | null; personneId?: string } | null>(null);
  const { data: personnes } = useQuery({ queryKey: ["personnes", false], queryFn: () => listePersonnes() });
  const { data: traitements } = useQuery({ queryKey: ["traitements", termines], queryFn: () => listeTraitements({ termines }) });
  const ecriture = peutEcrire() && !telephone;

  const arreter = (t: Ligne) =>
    modals.openConfirmModal({
      title: `Arrêter ${t.medicament} pour ${t.prenom} ?`,
      children: <Text size="sm">Le traitement prend fin aujourd'hui : il ne consomme plus de stock à partir de demain. Il reste dans l'historique.</Text>,
      labels: { confirm: "Arrêter", cancel: "Annuler" },
      onConfirm: () => ecrire(() => majTraitement(t.id, { fin: aujourdhui() }, t.modifieLe)),
    });
  const supprimer = (t: Ligne) =>
    modals.openConfirmModal({
      title: "Supprimer ce traitement ?",
      children: <Text size="sm">À réserver à une erreur de saisie : pour un arrêt, utilisez « Arrêter ». Le journal garde la fiche.</Text>,
      labels: { confirm: "Supprimer", cancel: "Annuler" },
      confirmProps: { color: "red" },
      onConfirm: () => ecrire(() => supprimerTraitement(t.id)),
    });

  return (
    <Stack p={telephone ? "md" : "xl"} gap="md" maw={1100}>
      <Group justify="space-between">
        <Title order={2}>Traitements</Title>
        <Group>
          <Switch label="Terminés" checked={termines} onChange={(e) => setTermines(e.currentTarget.checked)} />
          {ecriture && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setEdition({ traitement: null })} disabled={!personnes?.length}>
              Nouveau traitement
            </Button>
          )}
        </Group>
      </Group>
      {personnes?.length === 0 && <Text c="dimmed">Ajoutez d'abord les personnes suivies dans les Paramètres.</Text>}
      {personnes?.map((p) => {
        const siens = (traitements ?? []).filter((t) => t.personneId === p.id);
        return (
          <Card withBorder key={p.id}>
            <Group justify="space-between" mb="xs">
              <Title order={4}>{p.prenom}</Title>
              {ecriture && (
                <Button size="xs" variant="subtle" leftSection={<IconPlus size={14} />} onClick={() => setEdition({ traitement: null, personneId: p.id })}>
                  Ajouter
                </Button>
              )}
            </Group>
            {siens.length === 0 ? (
              <Text size="sm" c="dimmed">
                Aucun traitement{termines ? "" : " en cours"}.
              </Text>
            ) : (
              <Table>
                <Table.Tbody>
                  {siens.map((t) => {
                    const fini = !!t.fin && t.fin < aujourdhui();
                    return (
                      <Table.Tr key={t.id} c={fini ? "dimmed" : undefined}>
                        <Table.Td>
                          <Text fw={500}>{t.medicament}</Text>
                          {t.note && (
                            <Text size="xs" c="dimmed">
                              {t.note}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>{posologieLisible(t.posologie)}</Table.Td>
                        {!telephone && (
                          <Table.Td>
                            <Text size="sm">{periode(t)}</Text>
                          </Table.Td>
                        )}
                        {!telephone && <Table.Td>{t.delaiAlerte !== null && <Badge variant="light">alerte {t.delaiAlerte} j avant</Badge>}</Table.Td>}
                        <Table.Td w={40}>
                          {ecriture && (
                            <Menu position="bottom-end">
                              <Menu.Target>
                                <ActionIcon variant="subtle" color="gray" aria-label="Actions">
                                  <IconDots size={16} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => setEdition({ traitement: t })}>
                                  Modifier
                                </Menu.Item>
                                {!fini && (
                                  <Menu.Item leftSection={<IconPlayerStop size={14} />} onClick={() => arreter(t)}>
                                    Arrêter aujourd'hui
                                  </Menu.Item>
                                )}
                                {estAdmin() && (
                                  <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => supprimer(t)}>
                                    Supprimer
                                  </Menu.Item>
                                )}
                              </Menu.Dropdown>
                            </Menu>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          </Card>
        );
      })}
      <ModalTraitement ouvert={!!edition} traitement={edition?.traitement ?? null} personneId={edition?.personneId} onClose={() => setEdition(null)} />
    </Stack>
  );
}
