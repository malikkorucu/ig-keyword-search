import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TelegramChats1792090000000 implements MigrationInterface {
  name = 'TelegramChats1792090000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "telegram_chats" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "chat_id" character varying(64) NOT NULL,
        "label" character varying(100) NOT NULL DEFAULT '',
        "active" boolean NOT NULL DEFAULT true,
        "last_error" text,
        "last_sent_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_telegram_chats_chat_id" UNIQUE ("chat_id"),
        CONSTRAINT "PK_telegram_chats" PRIMARY KEY ("id")
      )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "telegram_chats"`);
  }
}
