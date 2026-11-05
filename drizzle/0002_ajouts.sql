CREATE TABLE `ajout` (
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
CREATE INDEX `ajout_stock_date_idx` ON `ajout` (`stock_id`,`date`);