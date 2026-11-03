import { useEffect, useState } from "react";
import { ActionIcon, Anchor, Badge, Button, Card, FileButton, Group, Stack, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconArchive, IconArchiveOff, IconArrowLeft, IconPaperclip, IconTrash } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ajouterPieces, archiverNote, ficheNote, majNote, retirerPiece, type FichierARattacher } from "../data/notes";
import { Historique } from "../components/Historique";
import { TYPES_ACCEPTES } from "../components/ModalNote";
import { tailleLisible } from "../lib/documents";
import { envoyerFichier, urlFichier } from "../lib/fichiers";
import { useEcran } from "../lib/ecran";
import { ecrire } from "../lib/query";
import { estAdmin, peutEcrire } from "../lib/session";
import { ficheNoteRoute } from "../router";

/**
 * EXEMPLE — fiche modifiable : la version lue (`modifieLe`) accompagne chaque écriture ; si quelqu'un d'autre a modifié
 * la note entre-temps, le serveur refuse (409) et l'interface le signale. Pièces jointes retirées = archivées.
 */
export function FicheNote() {
  const { id } = ficheNoteRoute.useParams();
  const { telephone } = useEcran();
  const { data: n, error } = useQuery({ queryKey: ["note", id], queryFn: () => ficheNote(id) });
  const [titre, setTitre] = useState("");
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    if (!n) return;
    setTitre(n.titre);
    setTexte(n.texte ?? "");
  }, [n?.modifieLe]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <Text p="xl">{error.message}</Text>;
  if (!n) return null;
  const modifiable = peutEcrire() && (!n.archivee || estAdmin());
  const change = titre !== n.titre || texte !== (n.texte ?? "");

  const joindre = async (fichiers: File[]) => {
    setEnvoi(true);
    try {
      const envoyes: FichierARattacher[] = [];
      for (const f of fichiers) {
        const r = await ecrire(() => envoyerFichier(f));
        if (r) envoyes.push({ fichier: r.fichier, nom: r.nom });
      }
      if (envoyes.length) await ecrire(() => ajouterPieces(id, envoyes));
    } finally {
      setEnvoi(false);
    }
  };
  const archiver = () =>
    modals.openConfirmModal({
      title: n.archivee ? "Ressortir cette note des archives ?" : "Archiver cette note ?",
      children: <Text size="sm">{n.archivee ? "Elle reviendra dans la liste des notes." : "Elle ne sera plus modifiable (sauf par un admin) ; rien n'est effacé."}</Text>,
      labels: { confirm: n.archivee ? "Désarchiver" : "Archiver", cancel: "Annuler" },
      onConfirm: () => ecrire(() => archiverNote(id, !n.archivee)),
    });

  return (
    <Stack p={telephone ? "md" : "xl"} gap="md" maw={900}>
      <Group justify="space-between">
        <Anchor component={Link} to="/notes" size="sm">
          <Group gap={4}>
            <IconArrowLeft size={14} /> Notes
          </Group>
        </Anchor>
        {peutEcrire() && (n.archivee ? estAdmin() : true) && (
          <Button variant="default" size="xs" leftSection={n.archivee ? <IconArchiveOff size={14} /> : <IconArchive size={14} />} onClick={archiver}>
            {n.archivee ? "Désarchiver" : "Archiver"}
          </Button>
        )}
      </Group>
      <Group gap="xs">
        <Title order={2}>{n.titre}</Title>
        {n.archivee && <Badge color="gray">Archivée</Badge>}
      </Group>
      <Card withBorder>
        <Stack>
          <TextInput label="Titre" value={titre} onChange={(e) => setTitre(e.currentTarget.value)} readOnly={!modifiable} />
          <Textarea label="Texte" autosize minRows={4} value={texte} onChange={(e) => setTexte(e.currentTarget.value)} readOnly={!modifiable} />
          {modifiable && (
            <Group justify="flex-end">
              <Button disabled={!change || !titre.trim()} onClick={() => ecrire(() => majNote(id, { titre, texte }, n.modifieLe))}>
                Enregistrer
              </Button>
            </Group>
          )}
        </Stack>
      </Card>
      <Card withBorder>
        <Group justify="space-between" mb="xs">
          <Title order={4}>Pièces jointes</Title>
          {modifiable && (
            <FileButton onChange={joindre} accept={TYPES_ACCEPTES} multiple>
              {(props) => (
                <Button {...props} size="xs" variant="light" leftSection={<IconPaperclip size={14} />} loading={envoi}>
                  Joindre
                </Button>
              )}
            </FileButton>
          )}
        </Group>
        <Stack gap={6}>
          {n.pieces.filter((p) => !p.archive).length === 0 && (
            <Text size="sm" c="dimmed">
              Aucune pièce jointe.
            </Text>
          )}
          {n.pieces
            .filter((p) => !p.archive)
            .map((p) => (
              <Group key={p.id} justify="space-between" wrap="nowrap">
                <Anchor href={urlFichier(p.fichier)} target="_blank" size="sm" truncate>
                  {p.nom}
                </Anchor>
                <Group gap="xs" wrap="nowrap">
                  <Text size="xs" c="dimmed">
                    {tailleLisible(p.taille)}
                  </Text>
                  {modifiable && (
                    <Tooltip label="Retirer (reste consultable depuis le journal)">
                      <ActionIcon variant="subtle" color="gray" onClick={() => ecrire(() => retirerPiece(p.id))} aria-label="Retirer">
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              </Group>
            ))}
        </Stack>
      </Card>
      {estAdmin() && !telephone && <Historique id={id} />}
    </Stack>
  );
}
