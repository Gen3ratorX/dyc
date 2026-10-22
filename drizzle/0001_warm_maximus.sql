CREATE TABLE `export_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`at` text NOT NULL,
	`care_day` text NOT NULL,
	`scope` text NOT NULL,
	`rows` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `request_buckets` (
	`id` text PRIMARY KEY NOT NULL,
	`requests` integer NOT NULL,
	`window` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `request_buckets_window` ON `request_buckets` (`window`);--> statement-breakpoint
ALTER TABLE `members` ADD `active` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `user_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `members_user_id` ON `members` (`user_id`);