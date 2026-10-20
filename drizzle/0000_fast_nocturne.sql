CREATE TABLE `oidc_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`issuer` text NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text NOT NULL,
	`scopes` text DEFAULT 'openid email profile' NOT NULL,
	`skip_email_verification` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `portainer_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`token` text NOT NULL,
	`insecure_tls` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_oidc_links` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`oidc_sub` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`provider_id`) REFERENCES `oidc_providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_oidc_links_provider_id_oidc_sub_unique` ON `user_oidc_links` (`provider_id`,`oidc_sub`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_oidc_links_provider_id_user_id_unique` ON `user_oidc_links` (`provider_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`webhook_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`message` text,
	`trigger_source` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`webhook_id`) REFERENCES `webhooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`token` text NOT NULL,
	`portainer_instance_id` text NOT NULL,
	`stack_id` integer NOT NULL,
	`endpoint_id` integer NOT NULL,
	`stack_name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`debounce_seconds` integer DEFAULT 5 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`portainer_instance_id`) REFERENCES `portainer_instances`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhooks_token_unique` ON `webhooks` (`token`);