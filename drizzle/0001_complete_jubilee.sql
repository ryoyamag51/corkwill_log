CREATE TABLE `auth_identities` (
	`provider` text NOT NULL,
	`subject` text NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_auth_identity_subject` ON `auth_identities` (`provider`,`subject`);--> statement-breakpoint
CREATE INDEX `idx_auth_identities_user` ON `auth_identities` (`user_id`);