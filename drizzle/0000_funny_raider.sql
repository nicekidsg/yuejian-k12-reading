CREATE TABLE `reader_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`friend_code` text NOT NULL,
	`secret_hash` text NOT NULL,
	`nickname` text NOT NULL,
	`completed_count` integer DEFAULT 0 NOT NULL,
	`started_count` integer DEFAULT 0 NOT NULL,
	`total_progress` integer DEFAULT 0 NOT NULL,
	`progress_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reader_profiles_friend_code_idx` ON `reader_profiles` (`friend_code`);--> statement-breakpoint
CREATE TABLE `reader_friendships` (
	`owner_id` text NOT NULL,
	`friend_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`owner_id`, `friend_id`),
	FOREIGN KEY (`owner_id`) REFERENCES `reader_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`friend_id`) REFERENCES `reader_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reader_friendships_owner_idx` ON `reader_friendships` (`owner_id`,`created_at`);
