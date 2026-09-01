import { NicheDefinitionSchema, type NicheDefinition } from '@umer/contracts';

export type NicheProfile = NicheDefinition & {
  businessCategories: string[];
  discoveryQueries: string[];
  businessSignals: string[];
  revenueModels: string[];
  acquisitionStrategies: string[];
  evidenceRequirements: string[];
};

export function validateNicheProfile(profile: NicheProfile): NicheProfile {
  NicheDefinitionSchema.parse(profile);
  if (profile.businessCategories.length === 0) throw new Error('Niche must define at least one business category');
  if (profile.discoveryQueries.length === 0) throw new Error('Niche must define at least one discovery query');
  if (profile.revenueModels.length === 0) throw new Error('Niche must define at least one revenue model');
  return profile;
}

export class InMemoryNicheProfileRegistry {
  private readonly profiles = new Map<string, NicheProfile>();

  upsert(profile: NicheProfile): void {
    this.profiles.set(profile.id, structuredClone(validateNicheProfile(profile)));
  }

  get(id: string): NicheProfile | undefined {
    const profile = this.profiles.get(id);
    return profile ? structuredClone(profile) : undefined;
  }

  list(): NicheProfile[] {
    return [...this.profiles.values()].map((profile) => structuredClone(profile));
  }
}

const now = new Date().toISOString();

export const SAUDI_UMRAH_NICHE: NicheProfile = validateNicheProfile({
  id: 'saudi-umrah',
  name: 'Saudi Umrah Services',
  description: 'Commercial discovery across the Saudi Umrah travel and pilgrimage-service ecosystem.',
  geographies: ['Saudi Arabia', 'Makkah', 'Madinah', 'Jeddah'],
  status: 'testing',
  priority: 'critical',
  targetBusinessesPerRun: 100,
  minimumOpportunityScore: 60,
  researchDepth: 'standard',
  problemHypotheses: [
    'Manual booking and inquiry handling creates slow response times.',
    'Small operators lack integrated websites, payments, CRM and customer automation.',
    'Hotels and transport providers lose demand through weak digital conversion flows.',
  ],
  discoverySignals: [
    'outdated website',
    'missing online booking',
    'manual WhatsApp inquiry flow',
    'missing payment integration',
    'poor multilingual experience',
    'weak lead capture',
    'poor review response workflow',
  ],
  allowedSolutionTypes: ['service', 'repeatable_service', 'product', 'partnership'],
  outreachMode: 'draft',
  createdAt: now,
  updatedAt: now,
  businessCategories: [
    'Umrah travel agency',
    'hotel',
    'transportation provider',
    'tour operator',
    'visa and pilgrimage service provider',
    'pilgrimage service provider',
    'local operator',
    'Umrah B2B support provider',
  ],
  discoveryQueries: [
    'Umrah travel agency Makkah',
    'Umrah travel agency Madinah',
    'Umrah transport Jeddah',
    'Umrah hotel Makkah',
    'Umrah hotel Madinah',
    'Umrah tour operator Saudi Arabia',
  ],
  businessSignals: [
    'website exists but lacks clear conversion path',
    'online inquiry volume appears high',
    'booking workflow appears manual',
    'multiple languages required',
    'payments handled manually',
    'repeated customer-service workload',
  ],
  revenueModels: [
    'implementation fee',
    'monthly SaaS subscription',
    'managed automation service',
    'lead-generation service',
    'integration/maintenance retainer',
  ],
  acquisitionStrategies: [
    'personalized website audit',
    'workflow automation offer',
    'booking/conversion improvement offer',
    'multilingual digital upgrade',
    'CRM and WhatsApp integration offer',
  ],
  evidenceRequirements: [
    'business website or authoritative listing',
    'at least one concrete operational or digital signal',
    'source URL for each material claim',
    'recent evidence where available',
  ],
});

export const BUILTIN_NICHE_PROFILES: readonly NicheProfile[] = [SAUDI_UMRAH_NICHE];
