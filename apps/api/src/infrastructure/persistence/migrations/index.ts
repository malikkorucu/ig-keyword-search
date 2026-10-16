import { Init1792080000000 } from './1792080000000-Init';
import { TelegramChats1792090000000 } from './1792090000000-TelegramChats';

/** Explicit list (no globs) so the same array works under ts-node, Jest and compiled dist. */
export const MIGRATIONS = [Init1792080000000, TelegramChats1792090000000];
