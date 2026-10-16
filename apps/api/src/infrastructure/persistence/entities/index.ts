import { AccountEntity } from './account.entity';
import { ApiTokenEntity } from './api-token.entity';
import { AppSettingsEntity } from './app-settings.entity';
import { KeywordEntity } from './keyword.entity';
import { MatchEntity } from './match.entity';
import { PollRunEntity } from './poll-run.entity';
import { ProcessedPostEntity } from './processed-post.entity';
import { TelegramChatEntity } from './telegram-chat.entity';

export {
  AccountEntity,
  ApiTokenEntity,
  AppSettingsEntity,
  KeywordEntity,
  MatchEntity,
  PollRunEntity,
  ProcessedPostEntity,
  TelegramChatEntity,
};

export const ENTITIES = [
  AppSettingsEntity,
  ApiTokenEntity,
  KeywordEntity,
  AccountEntity,
  ProcessedPostEntity,
  MatchEntity,
  PollRunEntity,
  TelegramChatEntity,
];
