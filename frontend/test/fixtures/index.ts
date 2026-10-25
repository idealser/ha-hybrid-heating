import config from './config.json';
import type { HhConfigReply, HhSettings } from '../../src/types';

export const CONFIG = config as unknown as HhConfigReply;
export const SETTINGS: HhSettings = CONFIG.settings;
import forecast from './forecast.json';
import type { HhForecast } from '../../src/types';

export const FORECAST = forecast as HhForecast;
export const TZ = 'Europe/Berlin';
import statusNow from './status-now.json';
import statusFrost from './status-frost.json';
import statusNulls from './status-nulls.json';
import log from './log.json';
import suggestions from './suggestions.json';
import type { HhLogEntry, HhStatus, HhSuggestion } from '../../src/types';

export const STATUS_NOW = statusNow as HhStatus;
export const STATUS_FROST = statusFrost as HhStatus;
export const STATUS_NULLS = statusNulls as HhStatus;
export const LOG = log as Record<'en' | 'ru', { entries: HhLogEntry[] }>;
export const SUGGESTIONS = suggestions as Record<'en' | 'ru', { suggestions: HhSuggestion[] }>;
