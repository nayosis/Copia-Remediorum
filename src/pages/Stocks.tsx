import { useState } from "react";
import { Alert, Button, Card, Group, Modal, Select, Stack, Switch, Table, Text, Title, UnstyledButton } from "@mantine/core";
import { IconAlertTriangle, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { creerStock, listeStocks, traitementsSansStock } from "../data/stocks";
import { listeMedicaments, listePersonnes } from "../data/referentiel";
import { BadgeStatut, echeanceLisible } from "../components/Statut";
import { ChampDate, ChampQuantite } from "../components/Champs";
import { aujourdhui, dateLisible } from "../lib/dates";
import { useEcran } from "../lib/ecran";
import { quantiteAvecUnite } from "../lib/quantites";
import { ecrire } from "../lib/query";
import { useSaisieRapide } from "../lib/saisie";
import { peutEcrire } from "../lib/session";

type Stock = Awaited<ReturnType<typeof listeStocks>>[number];

export const libelleStock = (s: { medicament: string; prenom: string | null }) => `${s.medicament} — ${s.prenom ?? "partagé"}`;
export const estimeLisible = (s: Stock) => (s.etat.estime === null ? "—" : quantiteAvecUnite(s.etat.estime, s.unite));

/** « Boîtes de » : "partage" (stock partagé) ou l'identifiant d'une personne (stock propre). */
export function ChampBoitesDe({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const { data: personnes } = useQuery({ queryKey: ["personnes", false], queryFn: () => listePersonnes() });
  return (
    <Select
      label="Boîtes de"
      required
      placeholder="Partagé ou propre à une personne ?"
      description="Partagé : l'armoire commune. Propre : les boîtes d'une seule personne, que ses traitements utilisent en priorité."
      data={[{ value: "partage", label: "Tout le monde (partagé)" }, ...(personnes ?? []).map((p) => ({ value: p.id, label: `${p.prenom} seulement` }))]}
      value={value}
      onChange={onChange}
    />
  );
}

/** Nouveau stock : partagé ou propre à une personne, avec un premier comptage facultatif. */
function ModalStock({ ouvert, onClose }: { ouvert: boolean; onClose: () => void }) {
  const { data: meds } = useQuery({ queryKey: ["medicaments", false], queryFn: () => listeMedicaments() });
  const [medicamentId, setMedicamentId] = useState<string | null>(null);
  const [pour, setPour] = useState<string | null>(null);
  const [quantite, setQuantite] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(aujourdhui());
  const enregistrer = async () => {
    if (!medicamentId || !pour) return;
    const r = await ecrire(() =>
      creerStock({ medicamentId, personneId: pour === "partage" ? null : pour, pointage: quantite !== null && date ? { date, quantite } : null }),
    );
    if (r === undefined) return;
    setMedicamentId(null);
    setPour(null);
    setQuantite(null);
    onClose();
  };
  return (
    <Modal opened={ouvert} onClose={onClose} title="Nouveau stock">
      <Stack>
        <Select label="Médicament" required searchable data={(meds ?? []).map((m) => ({ value: m.id, label: m.nom }))} value={medicamentId} onChange={setMedicamentId} />
        <ChampBoitesDe value={pour} onChange={setPour} />
        <Group grow align="flex-start">
          <ChampQuantite label="Premier comptage (facultatif)" valeur={quantite} onChange={setQuantite} pas={0.5} />
          <ChampDate label="Le soir du" value={date} onChange={setDate} />
        </Group>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={enregistrer} disabled={!medicamentId || !pour}>
            Créer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Tous les stocks, du plus urgent au moins urgent : ce soir, échéance, dernier pointage. */
export function Stocks() {
  const { telephone } = useEcran();
  const naviguer = useNavigate();
  const pointerStock = useSaisieRapide();
  const [archives, setArchives] = useState(false);
  const [creation, setCreation] = useState(false);
  const { data: stocks } = useQuery({ queryKey: ["stocks", archives], queryFn: () => listeStocks({ archives }) });
  const { data: sansStock } = useQuery({ queryKey: ["traitementsSansStock"], queryFn: () => traitementsSansStock() });
  const jour = aujourdhui();
  const ouvrir = (s: Stock) => naviguer({ to: "/stocks/$id", params: { id: s.id } });

  return (
    <Stack p={telephone ? "md" : "xl"} gap="md" maw={1200}>
      <Group justify="space-between">
        <Title order={2}>Stocks</Title>
        <Group>
          {!telephone && <Switch label="Archivés" checked={archives} onChange={(e) => setArchives(e.currentTarget.checked)} />}
          {peutEcrire() && !telephone && (
            <Button variant="default" leftSection={<IconPlus size={16} />} onClick={() => setCreation(true)}>
              Nouveau stock
            </Button>
          )}
          {peutEcrire() && pointerStock && !telephone && <Button onClick={() => pointerStock()}>Pointer / Réappro.</Button>}
        </Group>
      </Group>
      {!!sansStock?.length && (
        <Alert color="orange" icon={<IconAlertTriangle size={18} />} title="Traitements sans stock">
          {sansStock.map((t) => `${t.medicament} (${t.prenom})`).join(", ")} : créez un stock pour suivre ces médicaments.
        </Alert>
      )}
      {stocks?.length === 0 && <Text c="dimmed">Aucun stock : ils se créent avec le premier traitement de chaque médicament.</Text>}
      {telephone ? (
        <Stack gap="xs">
          {stocks?.map((s) => (
            <UnstyledButton key={s.id} onClick={() => ouvrir(s)}>
              <Card withBorder padding="sm">
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <div style={{ minWidth: 0 }}>
                    <Text fw={600} truncate>
                      {s.medicament}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {s.prenom ?? "Partagé"} · ce soir : {estimeLisible(s)}
                    </Text>
                    <Text size="xs">{echeanceLisible(s.etat, jour)}</Text>
                  </div>
                  <BadgeStatut etat={s.etat} />
                </Group>
              </Card>
            </UnstyledButton>
          ))}
        </Stack>
      ) : (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Médicament</Table.Th>
              <Table.Th>Boîtes de</Table.Th>
              <Table.Th style={{ whiteSpace: "nowrap" }}>Ce soir</Table.Th>
              <Table.Th>Échéance</Table.Th>
              <Table.Th style={{ whiteSpace: "nowrap" }}>Pointé le</Table.Th>
              <Table.Th>État</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {stocks?.map((s) => (
              <Table.Tr key={s.id} className="ligne-cliquable" onClick={() => ouvrir(s)} c={s.archive ? "dimmed" : undefined}>
                <Table.Td fw={500}>{s.medicament}</Table.Td>
                <Table.Td>{s.prenom ?? "Partagé"}</Table.Td>
                <Table.Td style={{ whiteSpace: "nowrap" }}>{estimeLisible(s)}</Table.Td>
                <Table.Td>
                  <Text size="sm">{s.etat.statut === "inconnu" ? "Jamais pointé" : echeanceLisible(s.etat, jour)}</Text>
                </Table.Td>
                <Table.Td style={{ whiteSpace: "nowrap" }}>{s.etat.pointage ? dateLisible(s.etat.pointage.date, { day: "numeric", month: "short", year: "numeric" }) : "—"}</Table.Td>
                <Table.Td style={{ whiteSpace: "nowrap" }}>
                  <BadgeStatut etat={s.etat} />
                </Table.Td>
                <Table.Td>
                  {peutEcrire() && pointerStock && !s.archive && (
                    <Button
                      size="compact-sm"
                      variant="light"
                      onClick={(e) => {
                        e.stopPropagation();
                        pointerStock(s.id);
                      }}
                    >
                      Pointer / Réappro.
                    </Button>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <ModalStock ouvert={creation} onClose={() => setCreation(false)} />
    </Stack>
  );
}
