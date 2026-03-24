export interface ProjectInfo {
  id: string;
  name: string;
  description: string;
  url: string;
  supabaseProject?: string;
  githubRepo?: string;
  vercelProject?: string;
}

/** Tab registry for the Projects & Agents page. */
export const projects: ProjectInfo[] = [
  {
    id: 'hardware',
    name: 'Hardware',
    description: 'Pi health, services and agent status',
    url: '',
  },
  {
    id: 'smagile-co',
    name: 'smagile.co',
    description: 'Company website with admin dashboard (Mission Control)',
    url: 'smagile.co',
    githubRepo: 'AgileSmagile/smagilewebsite-v2',
  },
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
    id: 'n8n',
    name: 'n8n',
    description: 'Workflow automation on Clawbox Pi5',
    url: 'n8n.smagile.co',
  },
];

export function getProject(id: string): ProjectInfo | undefined {
  return projects.find((p) => p.id === id);
}
