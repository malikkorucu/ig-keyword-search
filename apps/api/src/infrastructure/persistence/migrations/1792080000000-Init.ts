import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1792080000000 implements MigrationInterface {
  name = 'Init1792080000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "app_settings" (
        "id" smallint NOT NULL,
        "poll_interval_minutes" integer NOT NULL,
        "media_limit" integer NOT NULL,
        "ocr_enabled" boolean NOT NULL,
        "token_refresh_threshold_days" integer NOT NULL,
        "rate_limit_pause_minutes" integer NOT NULL,
        "poll_suspended_until" TIMESTAMP WITH TIME ZONE,
        "poll_suspend_reason" text,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_settings" PRIMARY KEY ("id")
      )`);
    await q.query(`
      CREATE TABLE "api_token" (
        "id" smallint NOT NULL,
        "access_token" text NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE,
        "last_refreshed_at" TIMESTAMP WITH TIME ZONE,
        "last_refresh_attempt_at" TIMESTAMP WITH TIME ZONE,
        "last_refresh_error" text,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_api_token" PRIMARY KEY ("id")
      )`);
    await q.query(`
      CREATE TABLE "keywords" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "value" character varying(100) NOT NULL,
        "normalized" character varying(100) NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_keywords_normalized" UNIQUE ("normalized"),
        CONSTRAINT "PK_keywords" PRIMARY KEY ("id")
      )`);
    await q.query(`
      CREATE TABLE "accounts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "username" character varying(30) NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "accessible" boolean NOT NULL DEFAULT true,
        "inaccessible_reason" text,
        "last_error" text,
        "last_checked_at" TIMESTAMP WITH TIME ZONE,
        "last_polled_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_accounts_username" UNIQUE ("username"),
        CONSTRAINT "PK_accounts" PRIMARY KEY ("id")
      )`);
    await q.query(`
      CREATE TABLE "processed_posts" (
        "post_id" character varying(64) NOT NULL,
        "account_id" uuid,
        "posted_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "matched" boolean NOT NULL DEFAULT false,
        "ocr_status" character varying(16) NOT NULL,
        "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_processed_posts" PRIMARY KEY ("post_id"),
        CONSTRAINT "FK_processed_posts_account" FOREIGN KEY ("account_id")
          REFERENCES "accounts"("id") ON DELETE SET NULL
      )`);
    await q.query(
      `CREATE INDEX "IDX_processed_posts_account_id" ON "processed_posts" ("account_id")`,
    );
    await q.query(`
      CREATE TABLE "matches" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "post_id" character varying(64) NOT NULL,
        "account_id" uuid,
        "username" character varying(30) NOT NULL,
        "keywords" text array NOT NULL,
        "source" character varying(8) NOT NULL,
        "snippet" text NOT NULL,
        "ocr_text" text,
        "permalink" text NOT NULL,
        "posted_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "detected_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'new',
        CONSTRAINT "UQ_matches_post_id" UNIQUE ("post_id"),
        CONSTRAINT "PK_matches" PRIMARY KEY ("id"),
        CONSTRAINT "FK_matches_account" FOREIGN KEY ("account_id")
          REFERENCES "accounts"("id") ON DELETE SET NULL
      )`);
    await q.query(`CREATE INDEX "IDX_matches_account_id" ON "matches" ("account_id")`);
    await q.query(`CREATE INDEX "IDX_matches_detected_at" ON "matches" ("detected_at")`);
    await q.query(`CREATE INDEX "IDX_matches_status" ON "matches" ("status")`);
    await q.query(`CREATE INDEX "IDX_matches_keywords" ON "matches" USING GIN ("keywords")`);
    await q.query(`
      CREATE TABLE "poll_runs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "trigger" character varying(16) NOT NULL,
        "status" character varying(16) NOT NULL,
        "started_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "finished_at" TIMESTAMP WITH TIME ZONE,
        "accounts_scanned" integer NOT NULL DEFAULT 0,
        "posts_scanned" integer NOT NULL DEFAULT 0,
        "new_posts" integer NOT NULL DEFAULT 0,
        "matches_found" integer NOT NULL DEFAULT 0,
        "ocr_jobs_enqueued" integer NOT NULL DEFAULT 0,
        "error_count" integer NOT NULL DEFAULT 0,
        "errors" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "note" text,
        CONSTRAINT "PK_poll_runs" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX "IDX_poll_runs_started_at" ON "poll_runs" ("started_at")`);

    // Initial seed (editable from the panel afterwards).
    await q.query(`
      INSERT INTO "app_settings"
        ("id", "poll_interval_minutes", "media_limit", "ocr_enabled", "token_refresh_threshold_days", "rate_limit_pause_minutes")
      VALUES (1, 15, 5, true, 10, 60)`);
    await q.query(`INSERT INTO "keywords" ("value", "normalized") VALUES ('alanya', 'alanya')`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "poll_runs"`);
    await q.query(`DROP TABLE "matches"`);
    await q.query(`DROP TABLE "processed_posts"`);
    await q.query(`DROP TABLE "accounts"`);
    await q.query(`DROP TABLE "keywords"`);
    await q.query(`DROP TABLE "api_token"`);
    await q.query(`DROP TABLE "app_settings"`);
  }
}
