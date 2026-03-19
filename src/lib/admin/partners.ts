import { getSupabaseAdmin } from './supabase';
import type { JobOpportunity } from './opportunities';

export interface PartnerProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  location: string | null;
  day_rate_min: number | null;
  day_rate_max: number | null;
  ir35_preference: string;
  availability: string;
  availability_from: string | null;
  skills: string[] | null;
  role_titles: string[] | null;
  bio: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PartnerMatchResult {
  score: number;
  reasons: string[];
}

/**
 * Fetch all active partner profiles, sorted by name.
 */
export async function getPartners(): Promise<PartnerProfile[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const { data, error } = await sb
    .from('partner_profiles')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('[Partners] Fetch error:', error.message);
    return [];
  }

  return (data || []) as PartnerProfile[];
}

/**
 * Fetch all active partners with their skills and role_titles for matching.
 * Same as getPartners but named explicitly for the matching use case.
 */
export async function getActivePartnersWithDetails(): Promise<PartnerProfile[]> {
  return getPartners();
}

/**
 * Get count of active partners for dashboard KPIs.
 */
export async function getPartnerCount(): Promise<number> {
  const sb = getSupabaseAdmin();
  if (!sb) return 0;

  const { count, error } = await sb
    .from('partner_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  if (error) {
    console.error('[Partners] Count error:', error.message);
    return 0;
  }

  return count || 0;
}

/**
 * Score how well a partner matches an opportunity using simple text heuristics.
 * Returns a score 0-100 and an array of reasons explaining the match.
 *
 * Scoring breakdown:
 *   - Role title match:  up to 40 points (exact title words in job title)
 *   - Skills match:      up to 40 points (skills/sectors in title or description)
 *   - Rate match:        up to 20 points (partner rate within opportunity range)
 */
export function scorePartnerMatch(
  partner: PartnerProfile,
  opportunity: JobOpportunity,
): PartnerMatchResult {
  const reasons: string[] = [];
  let score = 0;

  const jobTitle = (opportunity.title || '').toLowerCase();
  const jobSnippet = (opportunity.description_snippet || '').toLowerCase();
  const searchText = `${jobTitle} ${jobSnippet}`;

  // --- Role title matching (up to 40 points) ---
  const roleTitles = (partner.role_titles || []).filter(Boolean);
  if (roleTitles.length > 0) {
    const matchedTitles: string[] = [];
    for (const title of roleTitles) {
      const lowerTitle = title.toLowerCase();
      // Check if the role title (or meaningful words from it) appears in the job title
      if (jobTitle.includes(lowerTitle)) {
        matchedTitles.push(title);
      } else {
        // Try individual words (3+ chars) for partial matching
        const words = lowerTitle.split(/\s+/).filter((w) => w.length >= 3);
        const matchedWords = words.filter((w) => jobTitle.includes(w));
        if (matchedWords.length > 0 && matchedWords.length >= words.length * 0.5) {
          matchedTitles.push(title);
        }
      }
    }
    if (matchedTitles.length > 0) {
      const titleScore = Math.min(40, Math.round((matchedTitles.length / roleTitles.length) * 40));
      score += titleScore;
      reasons.push(`Role match: ${matchedTitles.join(', ')}`);
    }
  }

  // --- Skills matching (up to 40 points) ---
  const skills = (partner.skills || []).filter(Boolean);
  if (skills.length > 0) {
    const matchedSkills: string[] = [];
    for (const skill of skills) {
      if (searchText.includes(skill.toLowerCase())) {
        matchedSkills.push(skill);
      }
    }
    if (matchedSkills.length > 0) {
      const skillScore = Math.min(40, Math.round((matchedSkills.length / skills.length) * 40));
      score += skillScore;
      reasons.push(`Skills: ${matchedSkills.join(', ')}`);
    }
  }

  // --- Rate matching (up to 20 points) ---
  if (partner.day_rate_min !== null) {
    const oppMin = opportunity.day_rate_min;
    const oppMax = opportunity.day_rate_max;

    if (oppMin !== null || oppMax !== null) {
      const effectiveOppMax = oppMax ?? oppMin!;
      const effectiveOppMin = oppMin ?? oppMax!;

      if (partner.day_rate_min <= effectiveOppMax) {
        // Partner's minimum rate is within the opportunity's range
        score += 20;
        reasons.push(`Rate compatible (from £${partner.day_rate_min}/day)`);
      } else if (partner.day_rate_min <= effectiveOppMin * 1.15) {
        // Partner is slightly above range (within 15%), partial credit
        score += 10;
        reasons.push(`Rate close (partner from £${partner.day_rate_min}, role up to £${effectiveOppMax})`);
      }
    }
  }

  return { score: Math.min(100, score), reasons };
}
