CREATE TABLE `limits` (
	`id` text PRIMARY KEY NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pair` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`guest` text,
	`code_hash` text,
	`expires` integer DEFAULT 0 NOT NULL,
	`owner_subscription` text,
	`guest_subscription` text,
	`owner_sent` integer DEFAULT 0 NOT NULL,
	`guest_sent` integer DEFAULT 0 NOT NULL
);
