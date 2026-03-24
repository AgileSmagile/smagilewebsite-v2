import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('James Farley'),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const tools = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/tools' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    logo: z.string().optional(),
    description: z.string(),
    category: z.enum([
      'project management',
      'analytics',
      'monitoring',
      'CRM',
      'collaboration',
      'survey',
      'hosting',
      'productivity',
    ]),
    affiliateUrl: z.string().url().optional(),
    websiteUrl: z.string().url(),
    keyFeatures: z.array(z.string()).default([]),
    recommendation: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

export const collections = { blog, tools };
