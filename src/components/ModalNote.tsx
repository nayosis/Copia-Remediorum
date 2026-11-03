import { useState } from "react";
import { Button, FileButton, Group, Modal, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { IconCamera, IconPaperclip } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { creerNote } from "../data/notes";
import { envoyerFichier, type FichierEnvoye } from "../lib/fichiers";
import { ecrire } from "../lib/query";
import { useEcran } from "../lib/ecran";
import { tailleLisible } from "../lib/documents";

/** Types acceptés à l'envoi. Pas de image/heic : iOS convertit alors de lui-même la photo en JPEG. */
export const TYPES_ACCEPTES = "application/pdf,image/jpeg,image/png,image/webp,image/gif";

/** EXEMPLE — nouvelle note (plein écran sur téléphone, photo directe). */
export function ModalNote({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { telephone } = useEcran();
  const naviguer = useNavigate();
  const [titre, setTitre] = useState("");
  const [texte, setTexte] = useState("");
  const [pieces, setPieces] = useState<FichierEnvoye[]>([]);
  const [envoi, setEnvoi] = useState(false);

  const fermer = () => {
    setTitre("");
    setTexte("");
    setPieces([]);
    onClose();
  };
  const joindre = async (fichiers: File[]) => {
    setEnvoi(true);
    try {
      for (const f of fichiers) {
        const r = await ecrire(() => envoyerFichier(f));
        if (r) setPieces((p) => [...p, r]);
      }
    } finally {
      setEnvoi(false);
    }
  };
  const enregistrer = async () => {
    const id = await ecrire(() => creerNote({ titre, texte, pieces: pieces.map((p) => ({ fichier: p.fichier, nom: p.nom })) }));
    if (!id) return;
    fermer();
    naviguer({ to: "/notes/$id", params: { id } });
  };

  return (
    <Modal opened={opened} onClose={fermer} title="Nouvelle note" size="lg">
      <Stack>
        <TextInput label="Titre" required value={titre} onChange={(e) => setTitre(e.currentTarget.value)} data-autofocus />
        <Textarea label="Texte" autosize minRows={3} value={texte} onChange={(e) => setTexte(e.currentTarget.value)} />
        <Group gap="xs">
          {telephone && (
            <FileButton onChange={(f) => f && joindre([f])} accept="image/jpeg,image/png" capture="environment">
              {(props) => (
                <Button {...props} variant="light" leftSection={<IconCamera size={16} />} loading={envoi}>
                  Photo
                </Button>
              )}
            </FileButton>
          )}
          <FileButton onChange={joindre} accept={TYPES_ACCEPTES} multiple>
            {(props) => (
              <Button {...props} variant="default" leftSection={<IconPaperclip size={16} />} loading={envoi}>
                Joindre un fichier
              </Button>
            )}
          </FileButton>
        </Group>
        {pieces.map((p) => (
          <Text key={p.fichier} size="sm">
            {p.nom} <Text span c="dimmed">({tailleLisible(p.taille)})</Text>
          </Text>
        ))}
        <Group justify="flex-end">
          <Button variant="default" onClick={fermer}>
            Annuler
          </Button>
          <Button onClick={enregistrer} disabled={!titre.trim() || envoi}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
