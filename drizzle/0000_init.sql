CREATE TABLE `journal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quand` text NOT NULL,
	`utilisateur` text NOT NULL,
	`fonction` text NOT NULL,
	`cible` text,
	`resume` text,
	`avant` text,
	`apres` text
);
--> statement-breakpoint
CREATE INDEX `journal_quand_idx` ON `journal` (`quand`);--> statement-breakpoint
CREATE INDEX `journal_utilisateur_idx` ON `journal` (`utilisateur`);--> statement-breakpoint
CREATE INDEX `journal_cible_idx` ON `journal` (`cible`);--> statement-breakpoint
CREATE TABLE `note` (
	`id` text PRIMARY KEY NOT NULL,
	`titre` text NOT NULL,
	`texte` text,
	`archivee` integer DEFAULT false NOT NULL,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	`cree_par` text,
	`modifie_par` text,
	`modifie_le` text
);
--> statement-breakpoint
CREATE INDEX `note_archivee_idx` ON `note` (`archivee`);--> statement-breakpoint
CREATE TABLE `parametre` (
	`cle` text PRIMARY KEY NOT NULL,
	`valeur` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `piece_jointe` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`nom` text NOT NULL,
	`fichier` text NOT NULL,
	`mime` text NOT NULL,
	`taille` integer NOT NULL,
	`archive` integer DEFAULT false NOT NULL,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	`cree_par` text,
	`modifie_par` text,
	`modifie_le` text,
	FOREIGN KEY (`note_id`) REFERENCES `note`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `piece_jointe_note_idx` ON `piece_jointe` (`note_id`);