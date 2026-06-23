import type { TechnicianJobSummary } from '@/types/api';

export type JobCardVisualTheme = {
  badgeBackground: string;
  text: string;
  cardBackground: string;
  cardBorder: string;
};

const DEFAULT_THEME: JobCardVisualTheme = {
  badgeBackground: '#f3f4f6',
  text: '#6b7280',
  cardBackground: '#ffffff',
  cardBorder: '#e5e7eb'
};

/** Checked-in job card or order in progress — blue card + badge */
export const BLUE_ACTIVE_JOB_THEME: JobCardVisualTheme = {
  badgeBackground: '#bfdbfe',
  text: '#1e3a8a',
  cardBackground: '#eff6ff',
  cardBorder: '#3b82f6'
};

const statusTheme: Record<string, JobCardVisualTheme> = {
  pending: { badgeBackground: '#fff7ed', text: '#b45309', cardBackground: '#ffffff', cardBorder: '#e5e7eb' },
  assigned: { badgeBackground: '#eff6ff', text: '#1d4ed8', cardBackground: '#ffffff', cardBorder: '#e5e7eb' },
  open: { badgeBackground: '#eff6ff', text: '#1d4ed8', cardBackground: '#ffffff', cardBorder: '#e5e7eb' },
  inprogress: BLUE_ACTIVE_JOB_THEME,
  checkedin: BLUE_ACTIVE_JOB_THEME,
  completed: { badgeBackground: '#dcfce7', text: '#166534', cardBackground: '#f0fdf4', cardBorder: '#86efac' },
  followup: { badgeBackground: '#ffedd5', text: '#9a3412', cardBackground: '#fff7ed', cardBorder: '#fdba74' },
  cancelled: { badgeBackground: '#fee2e2', text: '#b91c1c', cardBackground: '#fef2f2', cardBorder: '#fca5a5' },
  locked: { badgeBackground: '#e5e7eb', text: '#374151', cardBackground: '#f9fafb', cardBorder: '#d1d5db' }
};

const normalizeStatus = (s: string | undefined) => (s || '').toLowerCase().replace(/[\s_-]/g, '');

/**
 * Theme for job rows on home / all-jobs. Uses job-card status; order `in_progress` also gets blue.
 */
export function resolveTechnicianJobListCardTheme(job: TechnicianJobSummary): JobCardVisualTheme {
  const j = normalizeStatus(job.status);
  const o = normalizeStatus(job.order?.status);

  const terminalJob = new Set(['completed', 'followup', 'locked']);
  if (terminalJob.has(j)) {
    return statusTheme[j] ?? DEFAULT_THEME;
  }

  if (j === 'checkedin' || o === 'inprogress') {
    return BLUE_ACTIVE_JOB_THEME;
  }

  return statusTheme[j] ?? DEFAULT_THEME;
}

export type JobDetailHeroTheme = {
  panelBackground: string;
  panelBorder: string;
  badgeBackground: string;
  badgeText: string;
};

const HERO_DEFAULT: JobDetailHeroTheme = {
  panelBackground: '#f9fafb',
  panelBorder: '#e5e7eb',
  badgeBackground: '#f3f4f6',
  badgeText: '#111827'
};

const HERO_BLUE: JobDetailHeroTheme = {
  panelBackground: '#eff6ff',
  panelBorder: '#3b82f6',
  badgeBackground: '#bfdbfe',
  badgeText: '#1e3a8a'
};

export function resolveJobDetailHeroTheme(
  jobCardStatus: string | undefined,
  orderStatus: string | undefined
): JobDetailHeroTheme {
  const j = normalizeStatus(jobCardStatus);
  const o = normalizeStatus(orderStatus);
  if (j === 'checkedin' || o === 'inprogress') return HERO_BLUE;
  return HERO_DEFAULT;
}
