export interface ProjectInfo {
  id: string;
  name: string;
  description: string;
  url: string;
  supabaseProject?: string;
  githubRepo?: string;
  vercelProject?: string;
}

/** Project registry - add new projects here. */
export const projects: ProjectInfo[] = [
  {
    id: 'mosaic-cv',
    name: 'Mosaic CV',
    description: 'Multi-tenant CV builder with AI coaching and variant generation',
    url: 'mosaic.smagile.co',
    supabaseProject: 'prziqrhqzwcfvhrzapfa',
    githubRepo: 'AgileSmagile/mosaic',
    vercelProject: 'mosaic',
  },
  {
    id: 'smagile-co',
    name: 'smagile.co',
    description: 'Company website with admin dashboard (Mission Control)',
    url: 'smagile.co',
    githubRepo: 'AgileSmagile/smagilewebsite-v2',
  },
];

export function getProject(id: string): ProjectInfo | undefined {
  return projects.find((p) => p.id === id);
}
