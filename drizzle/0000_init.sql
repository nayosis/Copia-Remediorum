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
CREATE TABLE `medicament` (
	`id` text PRIMARY KEY NOT NULL,
	`nom` text NOT NULL,
	`unite` text DEFAULT 'comprimé' NOT NULL,
	`seuil_alerte` integer,
	`note` text,
	`archive` integer DEFAULT false NOT NULL,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	`cree_par` text,
	`modifie_par` text,
	`modifie_le` text
);
--> statement-breakpoint
CREATE TABLE `parametre` (
	`cle` text PRIMARY KEY NOT NULL,
	`valeur` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `personne` (
	`id` text PRIMARY KEY NOT NULL,
	`prenom` text NOT NULL,
	`ordre` integer DEFAULT 0 NOT NULL,
	`archivee` integer DEFAULT false NOT NULL,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	`cree_par` text,
	`modifie_par` text,
	`modifie_le` text
);
--> statement-breakpoint
CREATE TABLE `traitement` (
	`id` text PRIMARY KEY NOT NULL,
	`personne_id` text NOT NULL,
	`medicament_id` text NOT NULL,
	`posologie` text,
	`debut` text NOT NULL,
	`fin` text,
	`delai_alerte` integer,
	`note` text,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	`cree_par` text,
	`modifie_par` text,
	`modifie_le` text,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`medicament_id`) REFERENCES `medicament`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `traitement_personne_idx` ON `traitement` (`personne_id`);--> statement-breakpoint
CREATE INDEX `traitement_medicament_idx` ON `traitement` (`medicament_id`);