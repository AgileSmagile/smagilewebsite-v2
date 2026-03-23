import { describe, it, expect } from 'vitest';
import { scoreOpportunity, type ProfileStructuredData } from './profile-matching';

function makeProfile(overrides?: Partial<ProfileStructuredData>): ProfileStructuredData {
  return {
    profile: { full_name: 'Alex Morgan', email: 'alex@example.com', location: 'Manchester' },
    experiences: [
      {
        job_title: 'Senior Software Engineer',
        organisation: 'Acme Corp',
        start_date: '2022-01-01',
        description: 'Led microservices migration and mentored junior engineers',
        achievements: [
          { raw_text: 'Migrated monolith to microservices reducing deployment time by 94%', tags: ['architecture', 'devops'] },
          { raw_text: 'Mentored 6 junior developers through pair programming' },
        ],
      },
      {
        job_title: 'Agile Coach',
        organisation: 'Consulting Ltd',
        start_date: '2019-06-01',
        end_date: '2021-12-31',
        description: 'Coached teams in Scrum and Kanban adoption',
        achievements: ['Facilitated retrospectives for 12 teams'],
      },
    ],
    skills: [
      { name: 'TypeScript', category: 'Technical' },
      { name: 'React', category: 'Technical' },
      { name: 'Agile Coaching', category: 'Practices' },
      { name: 'Scrum', category: 'Practices' },
      { name: 'Kubernetes', category: 'Platform' },
      { name: 'AWS', category: 'Platform' },
    ],
    certifications: [
      { name: 'Professional Scrum Master', issuing_body: 'Scrum.org' },
    ],
    ...overrides,
  };
}

describe('scoreOpportunity', () => {
  describe('direct skill matches', () => {
    it('matches exact skill names in opportunity text', () => {
      const result = scoreOpportunity(
        makeProfile(),
        'TypeScript Developer',
        'We need someone with TypeScript and React experience',
      );
      expect(result.directMatches).toContain('TypeScript');
      expect(result.directMatches).toContain('React');
      expect(result.score).toBeGreaterThan(0);
    });

    it('matches multi-word skill phrases', () => {
      const result = scoreOpportunity(
        makeProfile(),
        'Agile Coach needed',
        'Looking for agile coaching expertise',
      );
      expect(result.directMatches).toContain('Agile Coaching');
    });
  });

  describe('role title matching', () => {
    it('matches when opportunity title overlaps with experience titles', () => {
      const result = scoreOpportunity(
        makeProfile(),
        'Senior Software Engineer',
        'Join our engineering team',
      );
      expect(result.directMatches.some((m) => m.startsWith('Role:'))).toBe(true);
    });
  });

  describe('adjacent skill matching', () => {
    it('identifies adjacent skills via adjacency map', () => {
      const result = scoreOpportunity(
        makeProfile(),
        'Team Lead',
        'Must have experience with kanban and lean practices, sprint planning',
      );
      // Scrum is in profile, and sprint/kanban are adjacent to scrum
      expect(result.adjacentMatches.length).toBeGreaterThan(0);
    });
  });

  describe('score calculation', () => {
    it('returns 0 for completely unrelated opportunity', () => {
      const result = scoreOpportunity(
        makeProfile(),
        'Head Chef',
        'Experienced head chef for fine dining restaurant',
      );
      expect(result.score).toBe(0);
      expect(result.reasoning).toContain('No strong profile match');
    });

    it('caps score at 100', () => {
      // Create a profile with many matching skills
      const heavyProfile = makeProfile({
        skills: Array.from({ length: 20 }, (_, i) => ({ name: `skill${i}`, category: 'Tech' })),
      });
      const description = Array.from({ length: 20 }, (_, i) => `skill${i}`).join(' ');
      const result = scoreOpportunity(heavyProfile, 'Mega Match', description);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('gives higher scores for more matches', () => {
      const profile = makeProfile();
      const weak = scoreOpportunity(profile, 'AWS role', 'Uses AWS');
      const strong = scoreOpportunity(
        profile,
        'Senior Software Engineer',
        'TypeScript React Kubernetes AWS Scrum agile coaching microservices',
      );
      expect(strong.score).toBeGreaterThan(weak.score);
    });
  });

  describe('edge cases', () => {
    it('handles empty profile gracefully', () => {
      const result = scoreOpportunity(
        { skills: [], experiences: [], certifications: [] },
        'Developer',
        'TypeScript React',
      );
      expect(result.score).toBe(0);
    });

    it('handles null description', () => {
      const result = scoreOpportunity(makeProfile(), 'TypeScript Developer', null);
      expect(result.directMatches).toContain('TypeScript');
    });

    it('handles empty opportunity title', () => {
      const result = scoreOpportunity(makeProfile(), '', 'React developer');
      expect(result.directMatches).toContain('React');
    });

    it('is case insensitive', () => {
      const result = scoreOpportunity(makeProfile(), 'TYPESCRIPT DEVELOPER', 'REACT AND AWS');
      expect(result.directMatches).toContain('TypeScript');
      expect(result.directMatches).toContain('React');
      expect(result.directMatches).toContain('AWS');
    });
  });

  describe('reasoning', () => {
    it('includes direct matches in reasoning', () => {
      const result = scoreOpportunity(makeProfile(), 'React Dev', 'React TypeScript');
      expect(result.reasoning).toContain('Direct:');
    });

    it('includes adjacent matches in reasoning', () => {
      const result = scoreOpportunity(makeProfile(), 'Lead', 'kanban lean sprint planning');
      if (result.adjacentMatches.length > 0) {
        expect(result.reasoning).toContain('Adjacent:');
      }
    });
  });
});
