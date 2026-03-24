-- Seed outreach templates: 3 sectors x 3 touches = 9 templates

INSERT INTO outreach_templates (sector, sector_label, touch_number, touch_label, subject, body, personalisation_hooks)
VALUES
-- ============================================================
-- Cyber / Tech
-- ============================================================
(
  'cyber_tech',
  'Cyber / Tech',
  1,
  'Observation',
  NULL,
  E'Hi {{first_name}},\n\nI noticed {{signal}} at {{company_name}}. {{specific_observation}}.\n\nGrowth in cyber usually means more work-in-progress, more context switching, and delivery that felt fast at 15 people starting to stall at 40. The board still looks busy. Throughput tells a different story.\n\nNo ask here. I work with scaling tech and cyber companies in the Cheltenham corridor on exactly this problem, and your situation caught my eye.\n\nJames',
  '["first_name", "signal", "company_name", "specific_observation"]'::jsonb
),
(
  'cyber_tech',
  'Cyber / Tech',
  2,
  'Insight',
  NULL,
  E'Hi {{first_name}},\n\nFollowing up briefly. One pattern I see repeatedly in growing cyber firms: teams adopt a board and standups early, but never put WIP limits or flow metrics in place. Everything looks agile from the outside. Inside, work queues silently and cycle times creep up until someone asks "why is nothing shipping?"\n\nI run a {{relevant_offering}} that typically surfaces the three or four things actually causing the bottleneck. Fixed scope, {{offering_price}}, takes about a week. Not a transformation programme.\n\nWorth a conversation?\n\nJames',
  '["first_name", "relevant_offering", "offering_price"]'::jsonb
),
(
  'cyber_tech',
  'Cyber / Tech',
  3,
  'Respectful close',
  NULL,
  E'Hi {{first_name}},\n\nAppreciate you''re busy. I will not keep following up.\n\nIf {{company_name}} ever hits a point where delivery predictability becomes a problem you need to solve, I am in Cheltenham and this is what I do. Happy to have an honest conversation whenever that is, no pitch attached.\n\nJames',
  '["first_name", "company_name"]'::jsonb
),

-- ============================================================
-- Defence
-- ============================================================
(
  'defence',
  'Defence',
  1,
  'Observation',
  NULL,
  E'Hi {{first_name}},\n\nI came across {{company_name}} and {{signal}}. {{specific_observation}}.\n\nDefence delivery has a specific problem most agile consultants do not understand: security constraints, compliance gates, and approval queues that make textbook sprint planning irrelevant. The work is interrupt-heavy. The governance is slow. And the teams still get asked "when will it be done?"\n\nI have spent years in this space (Raytheon, Helyx/Lockheed Martin) and it is the context I know well. Wanted to introduce myself.\n\nJames',
  '["first_name", "company_name", "signal", "specific_observation"]'::jsonb
),
(
  'defence',
  'Defence',
  2,
  'Insight',
  NULL,
  E'Hi {{first_name}},\n\nQuick follow-up. Something I have found working in defence delivery: the single highest-value change is usually making queues visible. Most teams can see their work-in-progress but not their work-in-waiting. That waiting time is where weeks disappear.\n\nI offer a {{relevant_offering}} ({{offering_price}}) specifically designed for teams in constrained environments. One week, fixed scope, concrete recommendations. Not a framework rollout.\n\nIf that sounds relevant to what {{company_name}} is dealing with, happy to talk through it.\n\nJames',
  '["first_name", "relevant_offering", "offering_price", "company_name"]'::jsonb
),
(
  'defence',
  'Defence',
  3,
  'Respectful close',
  NULL,
  E'Hi {{first_name}},\n\nI will leave it here. No guilt, no "limited time offer".\n\nIf {{company_name}} ever needs someone who understands delivery in secure, regulated environments and does not try to force a Silicon Valley playbook onto a defence programme, I am local and available. Door is open.\n\nJames',
  '["first_name", "company_name"]'::jsonb
),

-- ============================================================
-- Insurance
-- ============================================================
(
  'insurance',
  'Insurance',
  1,
  'Observation',
  NULL,
  E'Hi {{first_name}},\n\n{{signal}} caught my attention at {{company_name}}. {{specific_observation}}.\n\nInsurance is in an odd place right now. Every carrier and MGA is running some form of digital transformation, but the delivery teams doing the work often lack flow visibility. Priorities shift quarterly. Regulatory change lands without warning. And the teams absorb it all without the tools to manage it.\n\nI have worked across UK insurance delivery for years and this pattern is consistent. Thought it was worth saying hello.\n\nJames',
  '["first_name", "signal", "company_name", "specific_observation"]'::jsonb
),
(
  'insurance',
  'Insurance',
  2,
  'Insight',
  NULL,
  E'Hi {{first_name}},\n\nOne thing I keep seeing in insurance programme delivery: teams estimate in sprints, stakeholders plan in quarters, and the board reports in milestones. Three different languages for the same work. Nobody has a shared view of what is actually flowing and what is stuck.\n\nI run a {{relevant_offering}} ({{offering_price}}) that gives delivery teams and their sponsors a shared, data-based view of where work stalls and why. Typically surfaces things people suspected but could not prove.\n\nWorth a conversation?\n\nJames',
  '["first_name", "relevant_offering", "offering_price"]'::jsonb
),
(
  'insurance',
  'Insurance',
  3,
  'Respectful close',
  NULL,
  E'Hi {{first_name}},\n\nLeaving it here. I know insurance programmes move on their own timeline.\n\nIf {{company_name}} gets to a point where delivery predictability or flow visibility becomes a priority, I am in Gloucester, I know the sector, and I do not do the hard sell. Get in touch whenever it makes sense.\n\nJames',
  '["first_name", "company_name"]'::jsonb
)
ON CONFLICT (sector, touch_number) DO NOTHING;
