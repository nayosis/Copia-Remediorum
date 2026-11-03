# Journal des versions

## v0.1.0 · Le socle

Première version du modèle, tirée de Cura Parentum 1.0 : tout ce qui ne dépend pas du métier.

**Nouveau**
- Comptes, rôles, liens d'invitation ; journal de preuve avant / après ; traçabilité et conflits d'écriture ;
  mise à jour en direct ; fichiers ; sauvegardes de la nuit et restauration ; vérification des nouvelles versions ;
  image Docker multi-architecture.
- Module d'exemple « notes » (pièces jointes, archivage, règle réservée aux admins), à remplacer.
- Ce que le socle doit savoir du modèle tient dans deux fichiers : `serveur/modele.ts` et `src/lib/modele.ts`.
- Tous les modules de `src/data/` sont exposés par RPC, sauf `_*.ts` : plus de liste à tenir à jour en double.
- `scripts/renommer.ts` : donne son nom à une nouvelle application.
- `CLAUDE.md`, skills `cadrage`, `architecture`, `socle-technique`, gabarit `docs/conception.md`.
