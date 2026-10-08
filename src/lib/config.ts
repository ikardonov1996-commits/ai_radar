// All token amounts and feed knobs come from the environment, never from code.
function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function getConfig() {
  return {
    welcomeBonus: num("WELCOME_BONUS_TOKENS", 100),
    surveyReward: num("SURVEY_REWARD_TOKENS", 10),
    dailyCap: num("DAILY_TOKEN_CAP", 100),
    withdrawMin: num("WITHDRAW_MIN_TOKENS", 1000),
    regPromptAfterSwipes: num("REG_PROMPT_AFTER_SWIPES", 5),
    surveyEveryNLikes: num("SURVEY_EVERY_N_LIKES", 5),
    neutralSlotShare: Math.min(1, Math.max(0, num("NEUTRAL_SLOT_SHARE", 0.2))),
  };
}

export type AppConfig = ReturnType<typeof getConfig>;

/** Values the client needs. Same shape for now, kept separate on purpose. */
export function getPublicConfig() {
  return getConfig();
}
export type PublicConfig = ReturnType<typeof getPublicConfig>;

export const FEED_BATCH = 20;
export const SWIPES_PER_MINUTE = 60;
export const CODE_REQUESTS_PER_HOUR = 5;
export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_MAX_ATTEMPTS = 5;
export const REG_PROMPT_REPEAT_EVERY = 15;
export const REG_PROMPT_MAX_PER_SESSION = 3;
export const SURVEY_MIN_DURATION_MS = 4000;
export const TEMPLATE_RUN_LENGTH = 5;
export const MAX_ACCOUNTS_PER_DEVICE_PER_DAY = 3;
