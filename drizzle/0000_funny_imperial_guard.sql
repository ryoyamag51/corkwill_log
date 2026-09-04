CREATE TABLE `daily_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`record_date` text NOT NULL,
	`status` text NOT NULL,
	`score` integer NOT NULL,
	`answers_json` text NOT NULL,
	`rubric_version_id` text NOT NULL,
	`evaluation_snapshot_json` text NOT NULL,
	`note` text,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_daily_records_user_date` ON `daily_records` (`user_id`,`record_date`);--> statement-breakpoint
CREATE INDEX `idx_daily_records_user_date_desc` ON `daily_records` (`user_id`,`record_date`);--> statement-breakpoint
CREATE TABLE `rubric_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`minimum_score` integer NOT NULL,
	`config_json` text NOT NULL,
	`effective_from` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rubric_versions_user_version` ON `rubric_versions` (`user_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `idx_rubric_versions_user_effective` ON `rubric_versions` (`user_id`,`effective_from`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `sync_mutations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`record_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`applied_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sync_mutations_user_id` ON `sync_mutations` (`user_id`,`id`);--> statement-breakpoint
CREATE INDEX `idx_sync_mutations_record` ON `sync_mutations` (`user_id`,`record_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`cutoff_hour` integer DEFAULT 5 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verification_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_verification_codes_email_created` ON `verification_codes` (`email`,`created_at`);