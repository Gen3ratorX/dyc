CREATE TABLE `atomic_guards` (
	`id` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL,
	CONSTRAINT "guard_one_change" CHECK("atomic_guards"."value" = 1)
);
--> statement-breakpoint
CREATE TABLE `commands` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`body` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`warrior_id` text NOT NULL,
	`kind` text NOT NULL,
	`care_day` text NOT NULL,
	`measured_at` text NOT NULL,
	`payload` text NOT NULL,
	`author` text NOT NULL,
	`author_id` text NOT NULL,
	`received_at` text NOT NULL,
	FOREIGN KEY (`warrior_id`) REFERENCES `warriors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `entries_warrior_time` ON `entries` (`warrior_id`,`measured_at`);--> statement-breakpoint
CREATE TABLE `members` (
	`email` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`groups_json` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `regimens` (
	`id` text PRIMARY KEY NOT NULL,
	`warrior_id` text NOT NULL,
	`medicine` text NOT NULL,
	`dose` text NOT NULL,
	`instructions` text NOT NULL,
	`author` text NOT NULL,
	`at` text NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`warrior_id`) REFERENCES `warriors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `regimen_version` ON `regimens` (`warrior_id`,`version`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`warrior_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text NOT NULL,
	`owner` text NOT NULL,
	`proposed_owner` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`outcome` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`warrior_id`) REFERENCES `warriors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `warriors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`age` integer NOT NULL,
	`group_name` text NOT NULL,
	`room` text NOT NULL,
	`guardian` text NOT NULL,
	`contact` text NOT NULL,
	`allergies` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
