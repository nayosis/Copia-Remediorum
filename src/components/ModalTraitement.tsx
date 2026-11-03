import { useState } from "react";
import { ActionIcon, Button, Chip, Group, Modal, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Switch, Text, Textarea, Tooltip } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { creerTraitement, majTraitement, type listeTraitements } from "../data/traitements";
import { lireParametres, listeMedicaments, listePersonnes } from "../data/referentiel";
import { ModalMedicament, nouveauMedicament } from "../pages/Parametres";
import { ChampDate, ChampQuantite } from "./Champs";
import { aujourdhui } from "../lib/dates";
import { erreurPosologie, JOURS_SEMAINE, MOMENTS, posologieLisible, type Moment, type Posologie, type Rythme } from "../lib/posologie";
import { ecrire } from "../lib/query";

type Ligne = Awaited<ReturnType<typeof listeTraitements>>[number];

type Etat = {
  personneId: string | null;
  medicamentId: string | null;
  sansPosologie: boolean;
  moments: Partial<Record<Moment, number>>;
  rythme: Rythme["type"];
  tousLes: number;
  jours: number[];
  debut: string | null;
  fin: string | null;
  delaiAlerte: number | null;
  note: string;
};

function etatInitial(t: Ligne | null, personneId?: string): Etat {
  const p = t?.posologie ?? null;
  return {
    personneId: t?.personneId ?? personneId ?? null,
    medicamentId: t?.medicamentId ?? null,
    sansPosologie: !!t && !p,
    moments: p?.moments ?? { matin: 4 },
    rythme: p?.rythme.type ?? "quotidien",
    tousLes: p?.rythme.type === "tous_les" ? p.rythme.jours : 2,
    jours: p?.rythme.type === "semaine" ? p.rythme.jours : [1],
    debut: t?.debut ?? aujourdhui(),
    fin: t?.fin ?? null,
    delaiAlerte: t?.delaiAlerte ?? null,
    note: t?.note ?? "",
  };
}

function posologieDe(e: Etat): Posologie | null {
  if (e.sansPosologie) return null;
  const rythme: Rythme = e.rythme === "quotidien" ? { type: "quotidien" } : e.rythme === "tous_les" ? { type: "tous_les", jours: e.tousLes } : { type: "semaine", jours: [...e.jours].sort() };
  const moments = Object.fromEntries(Object.entries(e.moments).filter(([, q]) => q)) as Posologie["moments"];
  return { moments, rythme };
}

/** Nouveau traitement ou modification (posologie, dates, délai d'alerte). Ordinateur ou tablette. */
export function ModalTraitement({ ouvert, traitement, personneId, onClose }: { ouvert: boolean; traitement: Ligne | null; personneId?: string; onClose: () => void }) {
  return (
    <Modal opened={ouvert} onClose={onClose} size="lg" title={traitement ? `${traitement.medicament} — ${traitement.prenom}` : "Nouveau traitement"}>
      {ouvert && <Formulaire key={traitement?.id ?? "nouveau"} traitement={traitement} personneId={personneId} onClose={onClose} />}
    </Modal>
  );
}

function Formulaire({ traitement, personneId, onClose }: { traitement: Ligne | null; personneId?: string; onClose: () => void }) {
  const [e, setE] = useState<Etat>(() => etatInitial(traitement, personneId));
  const [nouveauMed, setNouveauMed] = useState<ReturnType<typeof nouveauMedicament> | null>(null);
  const { data: personnes } = useQuery({ queryKey: ["personnes", false], queryFn: () => listePersonnes() });
  const { data: meds } = useQuery({ queryKey: ["medicaments", false], queryFn: () => listeMedicaments() });
  const { data: parametres } = useQuery({ queryKey: ["parametres"], queryFn: () => lireParametres() });
  const maj = (p: Partial<Etat>) => setE((x) => ({ ...x, ...p }));
  const posologie = posologieDe(e);
  const erreur = posologie ? erreurPosologie(posologie) : null;
  const pret = !!e.personneId && !!e.medicamentId && !!e.debut && !erreur;

  const enregistrer = async () => {
    if (!pret) return;
    const commun = { posologie, debut: e.debut!, fin: e.fin, delaiAlerte: e.delaiAlerte, note: e.note };
    const r = await ecrire<unknown>(() =>
      traitement ? majTraitement(traitement.id, commun, traitement.modifieLe) : creerTraitement({ ...commun, personneId: e.personneId!, medicamentId: e.medicamentId! }),
    );
    if (r !== undefined) onClose();
  };

  return (
    <Stack>
      {!traitement && (
        <SimpleGrid cols={2}>
          <Select label="Pour" required data={(personnes ?? []).map((p) => ({ value: p.id, label: p.prenom }))} value={e.personneId} onChange={(personneId) => maj({ personneId })} />
          <Group gap={4} align="flex-end" wrap="nowrap">
            <Select
              label="Médicament"
              required
              searchable
              nothingFoundMessage="Aucun : ajoutez-le avec +"
              data={(meds ?? []).map((m) => ({ value: m.id, label: m.nom }))}
              value={e.medicamentId}
              onChange={(medicamentId) => maj({ medicamentId })}
              style={{ flex: 1 }}
              data-autofocus
            />
            <Tooltip label="Nouveau médicament">
              <ActionIcon size={36} variant="default" onClick={() => setNouveauMed(nouveauMedicament())} aria-label="Nouveau médicament">
                <IconPlus size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </SimpleGrid>
      )}

      <Switch label="Sans posologie (pris si besoin : seuls les pointages comptent)" checked={e.sansPosologie} onChange={(x) => maj({ sansPosologie: x.currentTarget.checked })} />
      {!e.sansPosologie && (
        <>
          <SimpleGrid cols={4}>
            {MOMENTS.map((m) => (
              <ChampQuantite key={m.cle} label={m.libelle} valeur={e.moments[m.cle] ?? 0} onChange={(q) => maj({ moments: { ...e.moments, [m.cle]: q ?? 0 } })} />
            ))}
          </SimpleGrid>
          <Stack gap="xs">
            <SegmentedControl
              value={e.rythme}
              onChange={(v) => maj({ rythme: v as Rythme["type"] })}
              data={[
                { value: "quotidien", label: "Tous les jours" },
                { value: "tous_les", label: "Un jour sur N" },
                { value: "semaine", label: "Certains jours" },
              ]}
            />
            {e.rythme === "tous_les" && (
              <NumberInput label="Un jour sur" min={2} max={60} allowDecimal={false} value={e.tousLes} onChange={(v) => maj({ tousLes: Number(v) || 2 })} w={160} description="À partir de la date de début." />
            )}
            {e.rythme === "semaine" && (
              <Chip.Group multiple value={e.jours.map(String)} onChange={(v) => maj({ jours: v.map(Number) })}>
                <Group gap={6}>
                  {JOURS_SEMAINE.map((j, i) => (
                    <Chip key={j} value={String(i + 1)} size="sm">
                      {j}
                    </Chip>
                  ))}
                </Group>
              </Chip.Group>
            )}
          </Stack>
          <Text size="sm" c={erreur ? "red" : "dimmed"}>
            {erreur ?? posologieLisible(posologie)}
          </Text>
        </>
      )}

      <SimpleGrid cols={3}>
        <ChampDate label="Début" required value={e.debut} onChange={(debut) => maj({ debut })} />
        <ChampDate label="Fin (facultatif)" description="Traitement temporaire, ou arrêt." value={e.fin} onChange={(fin) => maj({ fin })} minDate={e.debut ?? undefined} />
        <NumberInput
          label="Délai d'alerte"
          description={`Vide : délai général (${parametres?.delaiAlerte ?? 7} j)`}
          suffix=" jours"
          min={0}
          max={120}
          allowDecimal={false}
          value={e.delaiAlerte ?? ""}
          onChange={(v) => maj({ delaiAlerte: v === "" ? null : Number(v) })}
        />
      </SimpleGrid>
      <Textarea label="Note" placeholder="Prescrit par le Dr Martin…" autosize minRows={1} value={e.note} onChange={(x) => maj({ note: x.currentTarget.value })} />
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Annuler
        </Button>
        <Button onClick={enregistrer} disabled={!pret}>
          Enregistrer
        </Button>
      </Group>
      <ModalMedicament edition={nouveauMed} onClose={() => setNouveauMed(null)} onCree={(medicamentId) => maj({ medicamentId })} />
    </Stack>
  );
}
