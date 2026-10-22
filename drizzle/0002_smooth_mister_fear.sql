CREATE TABLE `staff_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`last_seen` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `staff_sessions_user` ON `staff_sessions` (`user_id`);