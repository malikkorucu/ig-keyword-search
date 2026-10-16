import type {
  AccountDto,
  CreateAccountInput,
  DashboardDto,
  DiscoveredTelegramChatDto,
  KeywordDto,
  MatchDto,
  MatchesQuery,
  MatchStatus,
  Paginated,
  PollRunDto,
  SessionDto,
  SettingsDto,
  TelegramChatDto,
  TelegramStatusDto,
  TokenRefreshResultDto,
  TokenStatusDto,
  UpdateSettingsInput,
  VerifyAccountResultDto,
} from '@igw/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const keys = {
  session: ['session'] as const,
  dashboard: ['dashboard'] as const,
  matches: (q: Partial<MatchesQuery>) => ['matches', q] as const,
  accounts: ['accounts'] as const,
  keywords: ['keywords'] as const,
  settings: ['settings'] as const,
  pollRuns: (page: number) => ['poll-runs', page] as const,
};

export const useSession = () =>
  useQuery({ queryKey: keys.session, queryFn: () => api.get<SessionDto>('/auth/session') });

export const useDashboard = () =>
  useQuery({
    queryKey: keys.dashboard,
    queryFn: () => api.get<DashboardDto>('/dashboard'),
    refetchInterval: 15_000,
  });

export const useMatches = (q: Partial<MatchesQuery>) =>
  useQuery({
    queryKey: keys.matches(q),
    queryFn: () => api.get<Paginated<MatchDto>>('/matches', q),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

export const useAccounts = () =>
  useQuery({ queryKey: keys.accounts, queryFn: () => api.get<AccountDto[]>('/accounts') });
export const useKeywords = () =>
  useQuery({ queryKey: keys.keywords, queryFn: () => api.get<KeywordDto[]>('/keywords') });

export interface SettingsResponse {
  settings: SettingsDto;
  token: TokenStatusDto;
  nextPollAt: string | null;
}
export const useSettings = () =>
  useQuery({ queryKey: keys.settings, queryFn: () => api.get<SettingsResponse>('/settings') });

export const usePollRuns = (page: number) =>
  useQuery({
    queryKey: keys.pollRuns(page),
    queryFn: () => api.get<Paginated<PollRunDto>>('/poll-runs', { page, pageSize: 20 }),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });

function useInvalidate() {
  const qc = useQueryClient();
  return (...prefixes: string[]) =>
    Promise.all(prefixes.map((p) => qc.invalidateQueries({ queryKey: [p] })));
}

export function useUpdateMatchStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: MatchStatus }) =>
      api.patch<MatchDto>(`/matches/${id}`, { status }),
    onSuccess: () => invalidate('matches', 'dashboard'),
  });
}

export function useAccountMutations() {
  const invalidate = useInvalidate();
  const onSuccess = () => invalidate('accounts', 'dashboard');
  return {
    create: useMutation({
      mutationFn: (input: CreateAccountInput) => api.post<AccountDto>('/accounts', input),
      onSuccess,
    }),
    setActive: useMutation({
      mutationFn: ({ id, active }: { id: string; active: boolean }) =>
        api.patch<AccountDto>(`/accounts/${id}`, { active }),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.delete(`/accounts/${id}`), onSuccess }),
    verify: useMutation({
      mutationFn: (id: string) => api.post<VerifyAccountResultDto>(`/accounts/${id}/verify`),
      onSuccess,
    }),
  };
}

export function useKeywordMutations() {
  const invalidate = useInvalidate();
  const onSuccess = () => invalidate('keywords');
  return {
    create: useMutation({
      mutationFn: (value: string) => api.post<KeywordDto>('/keywords', { value }),
      onSuccess,
    }),
    setActive: useMutation({
      mutationFn: ({ id, active }: { id: string; active: boolean }) =>
        api.patch<KeywordDto>(`/keywords/${id}`, { active }),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.delete(`/keywords/${id}`), onSuccess }),
  };
}

export function useSettingsMutations() {
  const invalidate = useInvalidate();
  const onSuccess = () => invalidate('settings', 'dashboard');
  return {
    update: useMutation({
      mutationFn: (patch: UpdateSettingsInput) => api.patch<SettingsDto>('/settings', patch),
      onSuccess,
    }),
    refreshToken: useMutation({
      mutationFn: () => api.post<TokenRefreshResultDto>('/settings/token/refresh'),
      onSuccess,
    }),
    runPoll: useMutation({
      mutationFn: () => api.post<{ enqueued: boolean; message: string }>('/settings/poll/run'),
      onSuccess: () => invalidate('dashboard', 'poll-runs'),
    }),
    resume: useMutation({
      mutationFn: () => api.post<SettingsDto>('/settings/poll/resume'),
      onSuccess,
    }),
  };
}

export const useTelegram = () =>
  useQuery({ queryKey: ['telegram'], queryFn: () => api.get<TelegramStatusDto>('/telegram') });

export function useTelegramMutations() {
  const invalidate = useInvalidate();
  const onSuccess = () => invalidate('telegram');
  return {
    discover: useMutation({
      mutationFn: () => api.get<DiscoveredTelegramChatDto[]>('/telegram/discover'),
    }),
    create: useMutation({
      mutationFn: (input: { chatId: string; label?: string }) =>
        api.post<TelegramChatDto>('/telegram/chats', input),
      onSuccess,
    }),
    setActive: useMutation({
      mutationFn: ({ id, active }: { id: string; active: boolean }) =>
        api.patch<TelegramChatDto>(`/telegram/chats/${id}`, { active }),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/telegram/chats/${id}`),
      onSuccess,
    }),
    test: useMutation({
      mutationFn: (id: string) =>
        api.post<{ ok: boolean; message: string }>(`/telegram/chats/${id}/test`),
      onSuccess,
    }),
  };
}
