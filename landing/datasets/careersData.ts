/** Static fallback when CMS API is unavailable. Admin-managed roles live in careersStore. */
export const CAREER_ROLES_FALLBACK = [
  {
    refId: 'ENG-001',
    title: 'Founding AI Engineer',
    type: 'Full-time',
    location: 'Bengaluru',
    dept: 'Engineering',
    description:
      'Build the AI stack behind Yureka: intent matching, reward routing, and the concierge that places orders on member behalf.',
    applyEmail: 'support@yureka.one',
  },
  {
    refId: 'RSK-004',
    title: 'Credit Risk Analyst',
    type: 'Full-time',
    location: 'Bengaluru',
    dept: 'Risk',
    description:
      'Turn consented transaction signals into fair, explainable credit profiles for India\'s power shoppers.',
    applyEmail: 'support@yureka.one',
  },
  {
    refId: 'DES-012',
    title: 'Product Designer',
    type: 'Full-time',
    location: 'Bengaluru',
    dept: 'Design',
    description:
      'Shape fluid, Apple-grade product surfaces across web, mobile, and the RewardX extension.',
    applyEmail: 'support@yureka.one',
  },
  {
    refId: 'MKT-003',
    title: 'Growth Lead',
    type: 'Full-time',
    location: 'Bengaluru',
    dept: 'Marketing',
    description:
      'Own member acquisition loops, brand partnerships, and storytelling for Yureka Goldback.',
    applyEmail: 'support@yureka.one',
  },
  {
    refId: 'BIZ-008',
    title: 'Fintech Partnerships',
    type: 'Full-time',
    location: 'Bengaluru',
    dept: 'Business',
    description:
      'Close issuer, merchant, and gift-card partnerships that expand the Yureka rewards graph.',
    applyEmail: 'support@yureka.one',
  },
] as const

/** @deprecated use API / CAREER_ROLES_FALLBACK */
export const CAREER_ROLES = CAREER_ROLES_FALLBACK.map((role) => ({
  id: role.refId,
  title: role.title,
  type: role.type,
  location: role.location,
  dept: role.dept,
}))
