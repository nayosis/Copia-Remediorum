import { useState } from "react";
import { ActionIcon, Anchor, Badge, Button, Card, Group, Menu, Modal, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconArchive, IconArchiveOff, IconArrowLeft, IconDots, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { archiverStock, ficheStock, majAjout, majPointage, supprimerAjout, supprimerPointage } from "../data/stocks";
import { ModalMedicament } from "./Parametres";
import { listeMedicaments } from "../data/referentiel";
import { Historique } from "../components/Historique";
import { BadgeStatut, echeanceLisible } from "../components/Statut";
import { ChampDate, ChampQuantite } from "../components/Champs";
import { aujourdhui, dateLisible } from "../lib/dates";
import { useEcran } from "../lib/ecran";
import { posologieLisible } from "../lib/posologie";
import { quantiteAvecUnite, quantiteLisible } from "../lib/quantites";
import { ecrire } from "../lib/query";
import { useSaisieRapide } from "../lib/saisie";
import { estAdmin, peutEcrire } from "../lib/session";
import { ficheStockRoute } from "../router";

type Fiche = Awaited<ReturnType<typeof ficheStock>>;
type LignePointage = Fiche["mouvements"][number];

function Chiffre({ label, valeur, detail }: { label: string; valeur: string; detail?: string }) {
  return (
    <Card withBorder padding="md">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fz={24} fw={700} lh={1.2} mt={4}>
        {valeur}
      </Text>
      {detail && (
        <Text size="xs" c="dimmed" mt={2}>
          {detail}
        </Text>
      )}
    </Card>
  );
}

/** Correction d'un pointage ou d'un ajout (admins). */
function ModalCorrection({ pointage, unite, onClose }: { pointage: LignePointage | null; unite: string; onClose: () => void }) {
  const [quantite, setQuantite] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  if (!pointage) return null;
  const q = quantite ?? pointage.quantite;
  const d = date ?? pointage.date;
  const ajout = pointage.type === "ajout";
  return (
    <Modal opened onClose={onClose} title={ajout ? "Corriger le réapprovisionnement" : "Corriger le pointage"}>
      <Stack>
        <ChampQuantite label={ajout ? `Ajout (${unite})` : `Il restait (${unite})`} valeur={q} onChange={setQuantite} pas={0.5} />
        <ChampDate label={ajout ? "Le" : "Le soir du"} required value={d} onChange={setDate} />
        <Button
          onClick={async () =>
            (await ecrire(() => (ajout ? majAjout : majPointage)(pointage.id, { quantite: q, date: d }, pointage.modifieLe))) !== undefined && onClose()
          }
        >
          Enregistrer
        </Button>
      </Stack>
    </Modal>
  );
}

/** Fiche d'un stock : où en est-on, qui y puise, et l'histoire de ses pointages (écarts avec le calcul) et ajouts. */
export function FicheStock() {
  const { id } = ficheStockRoute.useParams();
  const { telephone } = useEcran();
  const pointerStock = useSaisieRapide();
  const { data: s, error } = useQuery({ queryKey: ["stock", id], queryFn: () => ficheStock(id) });
  const [correction, setCorrection] = useState<LignePointage | null>(null);
  // Le médicament du stock (nom, unité, seuil, note), modifié ici avec le choix « Boîtes de » du stock.
  const { data: medicaments } = useQuery({ queryKey: ["medicaments", true], queryFn: () => listeMedicaments({ archives: true }) });
  const [editionMed, setEditionMed] = useState<Parameters<typeof ModalMedicament>[0]["edition"]>(null);
  const medicament = medicaments?.find((m) => m.id === s?.medicamentId);
  const modifierMedicament = () =>
    medicament &&
    setEditionMed({ id: medicament.id, version: medicament.modifieLe, nom: medicament.nom, unite: medicament.unite, seuilAlerte: medicament.seuilAlerte, note: medicament.note ?? "" });
  if (error) return <Text p="xl">{error.message}</Text>;
  if (!s) return null;
  const jour = aujourdhui();
  const enCours = s.traitements.filter((t) => !t.fin || t.fin >= jour);

  const supprimer = (p: LignePointage) =>
    modals.openConfirmModal({
      title: p.type === "ajout" ? "Supprimer ce réapprovisionnement ?" : "Supprimer ce pointage ?",
      children: (
        <Text size="sm">
          {p.type === "ajout" ? "Le calcul ne comptera plus cet ajout." : "Le calcul repartira du pointage précédent."} Le journal en garde la trace.
        </Text>
      ),
      labels: { confirm: "Supprimer", cancel: "Annuler" },
      confirmProps: { color: "red" },
      onConfirm: () => ecrire(() => (p.type === "ajout" ? supprimerAjout : supprimerPointage)(p.id)),
    });

  return (
    <Stack p={telephone ? "md" : "xl"} gap="md" maw={1000}>
      <Group justify="space-between">
        <Anchor component={Link} to="/stocks" size="sm">
          <Group gap={4}>
            <IconArrowLeft size={14} /> Stocks
          </Group>
        </Anchor>
        {peutEcrire() && !telephone && (
          <Group gap="xs">
            <Button size="xs" variant="default" leftSection={<IconPencil size={14} />} onClick={modifierMedicament} disabled={!medicament}>
              Modifier
            </Button>
            <Button
              size="xs"
              variant="default"
              leftSection={s.archive ? <IconArchiveOff size={14} /> : <IconArchive size={14} />}
              onClick={() => ecrire(() => archiverStock(s.id, !s.archive))}
            >
              {s.archive ? "Désarchiver" : "Archiver"}
            </Button>
          </Group>
        )}
      </Group>
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="xs">
            <Title order={2}>{s.medicament}</Title>
            <BadgeStatut etat={s.etat} size="lg" />
            {s.archive && <Badge color="gray">Archivé</Badge>}
          </Group>
          <Text c="dimmed">{s.prenom ? `Boîtes de ${s.prenom}` : "Stock partagé (armoire commune)"}</Text>
        </div>
        {peutEcrire() && pointerStock && !s.archive && (
          <Group gap="xs">
            <Button variant="default" leftSection={<IconPlus size={16} />} onClick={() => pointerStock(s.id, "ajout")}>
              Réapprovisionner
            </Button>
            <Button onClick={() => pointerStock(s.id)}>Pointer</Button>
          </Group>
        )}
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Chiffre
          label="Ce soir (estimé)"
          valeur={s.etat.estime === null ? "—" : quantiteAvecUnite(s.etat.estime, s.unite)}
          detail={s.etat.pointage ? `Compté ${quantiteAvecUnite(s.etat.pointage.quantite, s.unite)} le ${dateLisible(s.etat.pointage.date)}` : "Jamais pointé"}
        />
        <Chiffre
          label="Épuisement"
          valeur={s.etat.epuisement ? dateLisible(s.etat.epuisement, { day: "numeric", month: "long" }) : "—"}
          detail={echeanceLisible(s.etat, jour)}
        />
        <Chiffre
          label="Renouveler à partir du"
          valeur={s.etat.alerteLe ? dateLisible(s.etat.alerteLe, { day: "numeric", month: "long" }) : s.etat.sousSeuil ? "Maintenant" : "—"}
          detail={`${s.etat.delai} jours avant l'épuisement${s.seuil !== null ? ` · seuil : ${quantiteAvecUnite(s.seuil, s.unite)}` : ""}`}
        />
      </SimpleGrid>

      <Card withBorder>
        <Title order={4} mb="xs">
          Qui y puise
        </Title>
        {enCours.length === 0 ? (
          <Text size="sm" c="dimmed">
            Aucun traitement en cours.
          </Text>
        ) : (
          <Stack gap={6}>
            {enCours.map((t) => (
              <Group key={t.id} justify="space-between">
                <Text size="sm">
                  <b>{t.prenom}</b> : {posologieLisible(t.posologie)}
                </Text>
                <Text size="xs" c="dimmed">
                  {t.fin ? `jusqu'au ${dateLisible(t.fin)}` : `depuis le ${dateLisible(t.debut)}`}
                  {t.delaiAlerte !== null ? ` · alerte ${t.delaiAlerte} j avant` : ""}
                </Text>
              </Group>
            ))}
          </Stack>
        )}
      </Card>

      <Card withBorder>
        <Title order={4} mb="xs">
          Pointages et réapprovisionnements
        </Title>
        {s.mouvements.length === 0 ? (
          <Text size="sm" c="dimmed">
            Aucun pointage : comptez ce qui reste, un soir après les prises.
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Le soir du</Table.Th>
                <Table.Th>Compté</Table.Th>
                {!telephone && <Table.Th>Prévu</Table.Th>}
                <Table.Th>Écart</Table.Th>
                {!telephone && <Table.Th>Note</Table.Th>}
                {estAdmin() && <Table.Th w={40} />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {s.mouvements.map((p) => {
                const ecart = p.attendu === null ? null : p.quantite - p.attendu;
                const ajout = p.type === "ajout";
                return (
                  <Table.Tr key={p.id}>
                    <Table.Td>{dateLisible(p.date)}</Table.Td>
                    <Table.Td fw={500} c={ajout ? "marque.7" : undefined}>
                      {ajout ? `+${quantiteLisible(p.quantite)} ajoutés` : quantiteLisible(p.quantite)}
                    </Table.Td>
                    {!telephone && <Table.Td c="dimmed">{p.attendu === null ? "—" : quantiteLisible(p.attendu)}</Table.Td>}
                    <Table.Td c={ecart === null || ecart === 0 ? "dimmed" : ecart < 0 ? "red.7" : "marque.7"}>
                      {ajout ? "" : ecart === null ? "—" : ecart === 0 ? "=" : `${ecart > 0 ? "+" : ""}${quantiteLisible(ecart)}`}
                    </Table.Td>
                    {!telephone && (
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {[p.note, p.creePar].filter(Boolean).join(" · ")}
                        </Text>
                      </Table.Td>
                    )}
                    {estAdmin() && (
                      <Table.Td>
                        <Menu position="bottom-end">
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray" aria-label="Actions">
                              <IconDots size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => setCorrection(p)}>
                              Corriger
                            </Menu.Item>
                            <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => supprimer(p)}>
                              Supprimer
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    )}
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
        <Text size="xs" c="dimmed" mt="xs">
          Écart : ce qui a été compté moins ce que le calcul prévoyait d'après le pointage précédent et les réapprovisionnements depuis (négatif : prise
          en trop, boîte perdue ; positif : oubli de prise, boîtes non saisies).
        </Text>
      </Card>
      {estAdmin() && !telephone && <Historique id={s.id} />}
      <ModalMedicament edition={editionMed} stock={s} onClose={() => setEditionMed(null)} />
      <ModalCorrection key={correction?.id} pointage={correction} unite={s.unite} onClose={() => setCorrection(null)} />
    </Stack>
  );
}
