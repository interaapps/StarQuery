CREATE TABLE `auth_tokens` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`kind` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`token_prefix` varchar(32) NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`storage` varchar(20) NOT NULL,
	`expires_at` timestamp,
	`last_used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `auth_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `data_sources` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` varchar(50) NOT NULL,
	`config_json` text NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `data_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `data_sources_project_name_unique` UNIQUE(`project_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `oidc_states` (
	`id` varchar(36) NOT NULL,
	`state` varchar(255) NOT NULL,
	`nonce` varchar(255) NOT NULL,
	`code_verifier` varchar(255) NOT NULL,
	`return_to` text NOT NULL,
	`storage` varchar(20) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `oidc_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `oidc_states_state_unique` UNIQUE(`state`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`position` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`permissions_json` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` varchar(36) NOT NULL,
	`role_id` varchar(36) NOT NULL,
	CONSTRAINT `user_roles_user_id_role_id_pk` PRIMARY KEY(`user_id`,`role_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`auth_provider` varchar(50) NOT NULL DEFAULT 'local',
	`external_subject` varchar(255),
	`password_hash` varchar(255),
	`password_salt` varchar(255),
	`permissions_json` text NOT NULL DEFAULT ('[]'),
	`disabled` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `auth_tokens` ADD CONSTRAINT `auth_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `data_sources` ADD CONSTRAINT `data_sources_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;