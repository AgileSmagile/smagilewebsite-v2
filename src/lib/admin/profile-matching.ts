import { getMosaicSupabase } from './supabase';

/**
 * Mosaic CV profile data assembled from the actual database tables
 * (not the structured_data JSONB blob, which may be null).
 */
export interface ProfileStructuredData {
  profile?: {
    full_name?: string;
    email?: string;
    location?: string;
  };
  experiences?: Array<{
    job_title: string;
    organisation: string;
    start_date: string;
    end_date?: string | null;
    description?: string;
    achievements?: Array<string | { raw_text: string; tags?: string[] }>;
  }>;
  skills?: Array<{
    name: string;
    category?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuing_body: string;
  }>;
}

export interface ProfileMatchResult {
  score: number;
  directMatches: string[];
  adjacentMatches: string[];
  reasoning: string;
}

/**
 * Fetch a Mosaic CV profile by email, assembled from the real database tables.
 * Connects to the Mosaic Supabase project (separate from the smagile website DB).
 */
export async function getProfileByEmail(email: string): Promise<ProfileStructuredData | null> {
  const sb = getMosaicSupabase();
  if (!sb) return null;

  // Look up the user profile by email
  const { data: profile, error: profileErr } = await sb
    .from('profiles')
    .select('id, full_name, email, location')
    .eq('email', email)
    .limit(1)
    .maybeSingle();

  if (profileErr) {
    console.error('[ProfileMatching] Profile fetch error:', profileErr.message);
    return null;
  }

  if (!profile) return null;

  // Fetch experiences, skills, and certifications in parallel
  const [expsResult, skillsResult, certsResult] = await Promise.all([
    sb.from('experiences')
      .select('job_title, organisation, start_date, end_date, description, achievements(content, tags)')
      .eq('user_id', profile.id)
      .order('sort_order'),
    sb.from('skills')
      .select('name, category')
      .eq('user_id', profile.id),
    sb.from('certifications')
      .select('name, issuing_body')
      .eq('user_id', profile.id),
  ]);

  if (expsResult.error) {
    console.error('[ProfileMatching] Experiences fetch error:', expsResult.error.message);
  }

  return {
    profile: {
      full_name: profile.full_name ?? undefined,
      email: profile.email ?? undefined,
      location: profile.location ?? undefined,
    },
    experiences: (expsResult.data ?? []).map(exp => ({
      job_title: exp.job_title,
      organisation: exp.organisation,
      start_date: exp.start_date,
      end_date: exp.end_date,
      description: exp.description ?? undefined,
      achievements: (exp.achievements ?? []).map((a: { content: string; tags?: string[] }) => ({
        raw_text: a.content,
        tags: a.tags,
      })),
    })),
    skills: skillsResult.data ?? [],
    certifications: certsResult.data ?? [],
  };
}

/**
 * Normalise a string for keyword matching: lowercase, strip punctuation, trim.
 */
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, '').trim();
}

/**
 * Tokenise a string into meaningful words (3+ chars, no common stop words).
 */
function tokenise(s: string): Set<string> {
  const stops = new Set([
    'the', 'and', 'for', 'with', 'you', 'your', 'our', 'this', 'that', 'from',
    'will', 'have', 'has', 'are', 'was', 'were', 'been', 'being', 'can', 'may',
    'should', 'would', 'could', 'must', 'shall', 'not', 'but', 'also', 'more',
    'about', 'into', 'over', 'such', 'only', 'other', 'than', 'then', 'them',
    'these', 'those', 'some', 'any', 'all', 'each', 'which', 'who', 'its',
    'per', 'via', 'etc', 'role', 'work', 'working', 'based', 'using', 'able',
    'day', 'days', 'rate', 'experience', 'required', 'opportunity', 'looking',
    'strong', 'good', 'well', 'within', 'across', 'through', 'need', 'needs',
  ]);
  const words = normalise(s).split(/\s+/).filter((w) => w.length >= 3 && !stops.has(w));
  return new Set(words);
}

/**
 * Extract multi-word skill phrases for better matching.
 * E.g. "Agile Coaching" should match as a phrase, not just "agile" and "coaching" separately.
 */
function extractPhrases(skills: Array<{ name: string }>): string[] {
  return skills.map((s) => normalise(s.name));
}

/**
 * Adjacent/transferable skill mapping.
 * Maps a normalised skill keyword to related terms that indicate adjacency.
 */
const ADJACENCY_MAP: Record<string, string[]> = {
  agile: ['scrum', 'kanban', 'lean', 'sprint', 'backlog', 'standup', 'retrospective', 'iteration', 'continuous improvement', 'delivery'],
  scrum: ['agile', 'sprint', 'backlog', 'product owner', 'scrum master'],
  kanban: ['agile', 'lean', 'flow', 'wip', 'pull system', 'continuous delivery'],
  coaching: ['mentoring', 'training', 'facilitation', 'leadership', 'development'],
  leadership: ['management', 'coaching', 'mentoring', 'strategy', 'director', 'head'],
  transformation: ['change management', 'digital', 'agile transformation', 'improvement', 'modernisation'],
  devops: ['cicd', 'pipeline', 'automation', 'infrastructure', 'deployment', 'kubernetes', 'docker', 'cloud'],
  cloud: ['aws', 'azure', 'gcp', 'infrastructure', 'devops', 'saas'],
  javascript: ['typescript', 'react', 'nodejs', 'frontend', 'fullstack'],
  typescript: ['javascript', 'react', 'nodejs', 'frontend', 'fullstack'],
  react: ['javascript', 'typescript', 'frontend', 'nextjs', 'ui'],
  project: ['programme', 'portfolio', 'delivery', 'management', 'pmo'],
  programme: ['project', 'portfolio', 'delivery', 'management'],
  consultant: ['consulting', 'advisory', 'strategy', 'freelance', 'contractor'],
  delivery: ['project', 'programme', 'agile', 'release', 'deployment'],
  product: ['product owner', 'product management', 'roadmap', 'backlog', 'stakeholder'],
  stakeholder: ['communication', 'management', 'engagement', 'governance'],
  facilitation: ['workshop', 'coaching', 'training', 'collaboration'],
};

/**
 * Score a single opportunity against the user's profile.
 * Returns a score (0-100), direct matches, adjacent matches, and reasoning.
 */
export function scoreOpportunity(
  profile: ProfileStructuredData,
  oppTitle: string,
  oppDescription: string | null,
): ProfileMatchResult {
  const directMatches: string[] = [];
  const adjacentMatches: string[] = [];

  // Build profile data sets
  const profileSkills = profile.skills || [];
  const profileSkillNames = profileSkills.map((s) => normalise(s.name));
  const profileSkillPhrases = extractPhrases(profileSkills);

  const profileRoleTitles = (profile.experiences || []).map((e) => normalise(e.job_title));

  // Gather all achievement tags and description keywords from experience
  const profileKeywords = new Set<string>();
  for (const exp of profile.experiences || []) {
    if (exp.description) {
      for (const token of tokenise(exp.description)) {
        profileKeywords.add(token);
      }
    }
    for (const ach of exp.achievements || []) {
      if (typeof ach === 'string') {
        for (const token of tokenise(ach)) {
          profileKeywords.add(token);
        }
      } else {
        if (ach.raw_text) {
          for (const token of tokenise(ach.raw_text)) {
            profileKeywords.add(token);
          }
        }
        for (const tag of ach.tags || []) {
          profileKeywords.add(normalise(tag));
        }
      }
    }
  }

  // Add skill names to keywords
  for (const name of profileSkillNames) {
    profileKeywords.add(name);
    // Also add individual words from multi-word skills
    for (const word of name.split(/\s+/)) {
      if (word.length >= 3) profileKeywords.add(word);
    }
  }

  // Add certification names
  for (const cert of profile.certifications || []) {
    for (const token of tokenise(cert.name)) {
      profileKeywords.add(token);
    }
  }

  // Tokenise opportunity text
  const oppText = `${oppTitle} ${oppDescription || ''}`;
  const oppTokens = tokenise(oppText);
  const oppNormalised = normalise(oppText);

  // 1. Direct skill matches (exact phrase match in opportunity text)
  for (const phrase of profileSkillPhrases) {
    if (oppNormalised.includes(phrase)) {
      directMatches.push(profileSkills.find((s) => normalise(s.name) === phrase)?.name || phrase);
    }
  }

  // 2. Direct role title overlap
  for (const role of profileRoleTitles) {
    // Check if any significant words from the role appear in the opportunity title
    const roleWords = role.split(/\s+/).filter((w) => w.length >= 3);
    const titleNorm = normalise(oppTitle);
    const matchingWords = roleWords.filter((w) => titleNorm.includes(w));
    if (matchingWords.length >= 2 || (roleWords.length === 1 && matchingWords.length === 1)) {
      const originalRole = (profile.experiences || []).find((e) => normalise(e.job_title) === role)?.job_title;
      if (originalRole && !directMatches.includes(`Role: ${originalRole}`)) {
        directMatches.push(`Role: ${originalRole}`);
      }
    }
  }

  // 3. Keyword overlap between profile experience and opportunity
  let keywordOverlapCount = 0;
  for (const token of oppTokens) {
    if (profileKeywords.has(token)) {
      keywordOverlapCount++;
    }
  }

  // 4. Adjacent skill matching
  for (const skillName of profileSkillNames) {
    const adjacentTerms = ADJACENCY_MAP[skillName] || [];
    // Also check individual words of multi-word skills
    for (const word of skillName.split(/\s+/)) {
      if (ADJACENCY_MAP[word]) {
        adjacentTerms.push(...ADJACENCY_MAP[word]);
      }
    }

    for (const term of adjacentTerms) {
      if (oppNormalised.includes(term) && !directMatches.some((d) => normalise(d) === term)) {
        const original = profileSkills.find((s) => normalise(s.name) === skillName)?.name || skillName;
        const label = `${original} (related: ${term})`;
        if (!adjacentMatches.includes(label)) {
          adjacentMatches.push(label);
        }
      }
    }
  }

  // Score calculation
  // Direct skill match: 8 points each (max 48)
  const directSkillScore = Math.min(directMatches.filter((d) => !d.startsWith('Role:')).length * 8, 48);
  // Direct role match: 15 points each (max 30)
  const directRoleScore = Math.min(directMatches.filter((d) => d.startsWith('Role:')).length * 15, 30);
  // Adjacent matches: 4 points each (max 16)
  const adjacentScore = Math.min(adjacentMatches.length * 4, 16);
  // Keyword overlap: scaled, max 6 points
  const keywordScore = Math.min(Math.floor(keywordOverlapCount / 3) * 2, 6);

  const rawScore = directSkillScore + directRoleScore + adjacentScore + keywordScore;
  const score = Math.min(rawScore, 100);

  // Build reasoning
  const reasoningParts: string[] = [];
  if (directMatches.length > 0) {
    reasoningParts.push(`Direct: ${directMatches.join(', ')}`);
  }
  if (adjacentMatches.length > 0) {
    reasoningParts.push(`Adjacent: ${adjacentMatches.join(', ')}`);
  }
  if (reasoningParts.length === 0) {
    reasoningParts.push('No strong profile match found');
  }

  return {
    score,
    directMatches,
    adjacentMatches,
    reasoning: reasoningParts.join(' | '),
  };
}
