CREATE TABLE `pointage` (
	`id` text PRIMARY KEY NOT NULL,
	`stock_id` text NOT NULL,
	`date` text NOT NULL,
	`quantite` integer NOT NULL,
	`note` text,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	`cree_par` text,
	`modifie_par` text,
	`modifie_le` text,
	FOREIGN KEY (`stock_id`) REFERENCES `stock`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `pointage_stock_date_idx` ON `pointage` (`stock_id`,`date`);--> statement-breakpoint
CREATE TABLE `stock` (
	`id` text PRIMARY KEY NOT NULL,
	`medicament_id` text NOT NULL,
	`personne_id` text,
	`archive` integer DEFAULT false NOT NULL,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	`cree_par` text,
	`modifie_par` text,
	`modifie_le` text,
	FOREIGN KEY (`medicament_id`) REFERENCES `medicament`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `stock_medicament_idx` ON `stock` (`medicament_id`);--> statement-breakpoint
-- Les traitements saisis avant les stocks puisent dans un stock partagé de leur médicament (identifiant au format UUID).
INSERT INTO `stock` (`id`, `medicament_id`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-'
    || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  m.id
FROM `medicament` m WHERE EXISTS (SELECT 1 FROM `traitement` t WHERE t.medicament_id = m.id);
