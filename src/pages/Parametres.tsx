import { useState } from "react";
import { ActionIcon, Badge, Button, Card, Group, Menu, Modal, NumberInput, Stack, Switch, Table, Text, Textarea, TextInput, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconArchive, IconArchiveOff, IconDots, IconPencil, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import {
  archiverMedicament, archiverPersonne, creerMedicament, creerPersonne, lireParametres, listeMedicaments, listePersonnes, majMedicament, majParametres, majPersonne,
} from "../data/referentiel";
import { ChampQuantite } from "../components/Champs";
import { quantiteAvecUnite } from "../lib/quantites";
import { ecrire } from "../lib/query";
import { peutEcrire } from "../lib/session";

type Med = Awaited<ReturnType<typeof listeMedicaments>>[number];

/** Petite fenêtre à un champ (nouveau prénom, renommage). */
function demanderTexte(titre: string, label: string, initial: string, valider: (v: string) => Promise<unknown>) {
  let valeur = initial;
  modals.openConfirmModal({
    title: titre,
    children: <TextInput label={label} defaultValue={initial} onChange={(e) => (valeur = e.currentTarget.value)} data-autofocus />,
    labels: { confirm: "Enregistrer", cancel: "Annuler" },
    onConfirm: () => ecrire(() => valider(valeur)),
  });
}

function Personnes({ ecriture }: { ecriture: boolean }) {
  const [archivees, setArchivees] = useState(false);
  const { data: personnes } = useQuery({ queryKey: ["personnes", archivees], queryFn: () => listePersonnes({ archivees }) });
  return (
    <Card withBorder>
      <Group justify="space-between" mb="sm">
        <Title order={4}>Personnes suivies</Title>
        <Group gap="xs">
          <Switch size="xs" label="Archivées" checked={archivees} onChange={(e) => setArchivees(e.currentTarget.checked)} />
          {ecriture && (
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => demanderTexte("Nouvelle personne", "Prénom", "", (prenom) => creerPersonne({ prenom }))}>
              Ajouter
            </Button>
          )}
        </Group>
      </Group>
      {personnes?.length === 0 && (
        <Text size="sm" c="dimmed">
          Ajoutez les personnes dont vous suivez les médicaments (« Jeanne », « Robert »).
        </Text>
      )}
      <Stack gap={4}>
        {personnes?.map((p) => (
          <Group key={p.id} justify="space-between">
            <Group gap="xs">
              <Text fw={500}>{p.prenom}</Text>
              {p.archivee && <Badge color="gray">Archivée</Badge>}
            </Group>
            {ecriture && (
              <Group gap={4}>
                <ActionIcon variant="subtle" color="gray" aria-label="Renommer" onClick={() => demanderTexte("Renommer", "Prénom", p.prenom, (prenom) => majPersonne(p.id, { prenom }, p.modifieLe))}>
                  <IconPencil size={16} />
                </ActionIcon>
                <ActionIcon variant="subtle" color="gray" aria-label={p.archivee ? "Désarchiver" : "Archiver"} onClick={() => ecrire(() => archiverPersonne(p.id, !p.archivee))}>
                  {p.archivee ? <IconArchiveOff size={16} /> : <IconArchive size={16} />}
                </ActionIcon>
              </Group>
            )}
          </Group>
        ))}
      </Stack>
    </Card>
  );
}

type EditionMed = { id?: string; version?: string | null; nom: string; unite: string; seuilAlerte: number | null; note: string };

/** Création et modification d'un médicament. Exportée : la fenêtre des traitements en crée aussi. */
export function ModalMedicament({ edition, onClose, onCree }: { edition: EditionMed | null; onClose: () => void; onCree?: (id: string) => void }) {
  return (
    <Modal opened={!!edition} onClose={onClose} title={edition?.id ? "Modifier le médicament" : "Nouveau médicament"}>
      {edition && <FormMedicament key={edition.id ?? "nouveau"} initial={edition} onClose={onClose} onCree={onCree} />}
    </Modal>
  );
}

function FormMedicament({ initial, onClose, onCree }: { initial: EditionMed; onClose: () => void; onCree?: (id: string) => void }) {
  const [v, setV] = useState(initial);
  const enregistrer = async () => {
    const saisie = { nom: v.nom, unite: v.unite, seuilAlerte: v.seuilAlerte, note: v.note };
    const r = await ecrire<unknown>(() => (v.id ? majMedicament(v.id, saisie, v.version) : creerMedicament(saisie)));
    if (r === undefined) return;
    if (!v.id && typeof r === "string") onCree?.(r);
    onClose();
  };
  return (
    <Stack>
      <TextInput label="Nom" placeholder="Kardégic 75 mg" required value={v.nom} onChange={(e) => setV({ ...v, nom: e.currentTarget.value })} data-autofocus />
      <TextInput label="Unité" description="Ce que l'on compte : comprimé, gélule, sachet…" value={v.unite} onChange={(e) => setV({ ...v, unite: e.currentTarget.value })} />
      <ChampQuantite
        label="Seuil d'alerte (facultatif)"
        description="Prévenir quand le stock passe sous ce nombre ; utile surtout pour un médicament pris « si besoin »."
        valeur={v.seuilAlerte}
        onChange={(seuilAlerte) => setV({ ...v, seuilAlerte })}
        pas={1}
      />
      <Textarea label="Note" autosize minRows={2} value={v.note} onChange={(e) => setV({ ...v, note: e.currentTarget.value })} />
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Annuler
        </Button>
        <Button onClick={enregistrer} disabled={!v.nom.trim()}>
          Enregistrer
        </Button>
      </Group>
    </Stack>
  );
}

export const nouveauMedicament = (nom = ""): EditionMed => ({ nom, unite: "comprimé", seuilAlerte: null, note: "" });

function Medicaments({ ecriture }: { ecriture: boolean }) {
  const [archives, setArchives] = useState(false);
  const { data: meds } = useQuery({ queryKey: ["medicaments", archives], queryFn: () => listeMedicaments({ archives }) });
  const [edition, setEdition] = useState<EditionMed | null>(null);
  const modifier = (m: Med) => setEdition({ id: m.id, version: m.modifieLe, nom: m.nom, unite: m.unite, seuilAlerte: m.seuilAlerte, note: m.note ?? "" });
  return (
    <Card withBorder>
      <Group justify="space-between" mb="sm">
        <Title order={4}>Médicaments</Title>
        <Group gap="xs">
          <Switch size="xs" label="Archivés" checked={archives} onChange={(e) => setArchives(e.currentTarget.checked)} />
          {ecriture && (
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setEdition(nouveauMedicament())}>
              Ajouter
            </Button>
          )}
        </Group>
      </Group>
      {meds?.length === 0 ? (
        <Text size="sm" c="dimmed">
          Aucun médicament. Ils s'ajoutent ici ou à la création d'un traitement.
        </Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nom</Table.Th>
              <Table.Th>Unité</Table.Th>
              <Table.Th>Seuil d'alerte</Table.Th>
              <Table.Th>Traitements en cours</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {meds?.map((m) => (
              <Table.Tr key={m.id}>
                <Table.Td>
                  <Group gap="xs">
                    <Text fw={500}>{m.nom}</Text>
                    {m.archive && <Badge color="gray">Archivé</Badge>}
                  </Group>
                  {m.note && (
                    <Text size="xs" c="dimmed">
                      {m.note}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>{m.unite}</Table.Td>
                <Table.Td>{m.seuilAlerte !== null ? `sous ${quantiteAvecUnite(m.seuilAlerte, m.unite)}` : "—"}</Table.Td>
                <Table.Td>{m.traitementsEnCours || "—"}</Table.Td>
                <Table.Td>
                  {ecriture && (
                    <Menu position="bottom-end">
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray" aria-label="Actions">
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => modifier(m)}>
                          Modifier
                        </Menu.Item>
                        <Menu.Item leftSection={m.archive ? <IconArchiveOff size={14} /> : <IconArchive size={14} />} onClick={() => ecrire(() => archiverMedicament(m.id, !m.archive))}>
                          {m.archive ? "Désarchiver" : "Archiver"}
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <ModalMedicament edition={edition} onClose={() => setEdition(null)} />
    </Card>
  );
}

function Alertes({ ecriture }: { ecriture: boolean }) {
  const { data } = useQuery({ queryKey: ["parametres"], queryFn: () => lireParametres() });
  const [delai, setDelai] = useState<number | string | null>(null);
  const valeur = delai ?? data?.delaiAlerte ?? "";
  return (
    <Card withBorder>
      <Title order={4} mb="sm">
        Alertes
      </Title>
      <Group align="flex-end">
        <NumberInput
          label="Prévenir avant l'épuisement du stock"
          description="Le temps d'obtenir l'ordonnance et de passer à la pharmacie. Un traitement peut avoir son propre délai."
          suffix=" jours"
          min={0}
          max={120}
          allowDecimal={false}
          value={valeur}
          onChange={setDelai}
          readOnly={!ecriture}
          w={420}
        />
        {ecriture && (
          <Button
            disabled={delai === null || delai === "" || Number(delai) === data?.delaiAlerte}
            onClick={async () => {
              if ((await ecrire(() => majParametres({ delaiAlerte: Number(delai) }))) === undefined) return;
              setDelai(null);
              notifications.show({ color: "green", message: "Délai d'alerte enregistré." });
            }}
          >
            Enregistrer
          </Button>
        )}
      </Group>
    </Card>
  );
}

/** Paramètres (ordinateur ou tablette) : personnes, médicaments, délai d'alerte général. */
export function Parametres() {
  const ecriture = peutEcrire();
  return (
    <Stack p="xl" gap="md" maw={1000}>
      <Title order={2}>Paramètres</Title>
      <Personnes ecriture={ecriture} />
      <Medicaments ecriture={ecriture} />
      <Alertes ecriture={ecriture} />
    </Stack>
  );
}
