CREATE TABLE `webhook_event_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`step` text NOT NULL,
	`data` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `webhook_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `webhook_event_steps_event_idx` ON `webhook_event_steps` (`event_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `webhooks` ADD `deploy_timeout_seconds` integer DEFAULT 300 NOT NULL;--> statement-breakpoint
-- Backfill the step log for events recorded before the state machine
-- existed. The old worker ran fetch + PUT as one blob and only reported
-- success/error, so each row is inferred from what the old code could
-- only have done — matching what the new machine records for the same
-- situation:
--   created → created + queued:  never started; born pickable.
--   running → deploying: was mid-blob at upgrade time. Conservative: the
--             blob may have been at the PUT, and re-sending could pull a
--             newer image than CI asked for (one-PUT invariant).
--   success → deploying: fact — the old flow only reported success after
--             the PUT returned.
--   error   → known messages map to their exact new-machine positions;
--             indeterminate ones (fetch or PUT) get only the terminal row.
-- Terminal rows carry the old message in data. Step rows are inserted
-- before terminal rows so same-timestamp pairs order correctly by rowid.
INSERT INTO `webhook_event_steps` (`id`,`event_id`,`step`,`data`,`created_at`)
  SELECT 'stp_' || lower(hex(randomblob(12))), `id`, 'created', NULL, `created_at`
  FROM `webhook_events` WHERE `status` = 'queued';--> statement-breakpoint
INSERT INTO `webhook_event_steps` (`id`,`event_id`,`step`,`data`,`created_at`)
  SELECT 'stp_' || lower(hex(randomblob(12))), `id`, 'queued', NULL, `created_at`
  FROM `webhook_events` WHERE `status` = 'queued';--> statement-breakpoint
INSERT INTO `webhook_event_steps` (`id`,`event_id`,`step`,`data`,`created_at`)
  SELECT 'stp_' || lower(hex(randomblob(12))), `id`, 'deploying', NULL, `created_at`
  FROM `webhook_events` WHERE `status` = 'running';--> statement-breakpoint
INSERT INTO `webhook_event_steps` (`id`,`event_id`,`step`,`data`,`created_at`)
  SELECT 'stp_' || lower(hex(randomblob(12))), `id`, 'deploying', NULL, `created_at`
  FROM `webhook_events` WHERE `status` = 'success';--> statement-breakpoint
INSERT INTO `webhook_event_steps` (`id`,`event_id`,`step`,`data`,`created_at`)
  SELECT 'stp_' || lower(hex(randomblob(12))), `id`,
    CASE WHEN `message` LIKE '%already in progress%' THEN 'deploying' ELSE 'claimed' END,
    NULL, `created_at`
  FROM `webhook_events` WHERE `status` = 'error' AND (
    `message` LIKE '%already in progress%'
    OR `message` IN ('Webhook not found', 'Webhook is disabled', 'Portainer instance not found')
  );--> statement-breakpoint
INSERT INTO `webhook_event_steps` (`id`,`event_id`,`step`,`data`,`created_at`)
  SELECT 'stp_' || lower(hex(randomblob(12))), `id`, `status`, json_object('message', `message`), `created_at`
  FROM `webhook_events` WHERE `status` IN ('success', 'error');--> statement-breakpoint
ALTER TABLE `webhook_events` DROP COLUMN `status`;--> statement-breakpoint
ALTER TABLE `webhook_events` DROP COLUMN `message`;
