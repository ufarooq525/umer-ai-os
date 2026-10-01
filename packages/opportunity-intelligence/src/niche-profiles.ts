import { NicheDefinitionSchema, type NicheDefinition } from '@umer/contracts';

export type OutreachTemplate = {
  channel: 'whatsapp' | 'email';
  language: 'ar' | 'en' | 'bilingual';
  subject?: string;
  body: string;
};

type NicheProfileMetadata = {
  businessCategories: string[];
  discoveryQueries: string[];
  businessSignals: string[];
  revenueModels: string[];
  acquisitionStrategies: string[];
  evidenceRequirements: string[];
  outreachTemplates: OutreachTemplate[];
  placesTypes?: string[];
};

export type NicheProfile = NicheDefinition & NicheProfileMetadata;

export function validateNicheProfile(profile: NicheProfile): NicheProfile {
  const {
    businessCategories,
    discoveryQueries,
    businessSignals,
    revenueModels,
    acquisitionStrategies,
    evidenceRequirements,
    outreachTemplates,
    placesTypes,
    ...definition
  } = profile;
  NicheDefinitionSchema.parse(definition);
  for (const [name, values] of Object.entries({ businessCategories, discoveryQueries, businessSignals, revenueModels, acquisitionStrategies, evidenceRequirements })) {
    if (!values.length) throw new Error(`Niche must define at least one ${name}`);
    if (values.some((value) => !value.trim())) throw new Error(`Niche ${name} cannot contain empty values`);
  }
  if (!outreachTemplates || outreachTemplates.length === 0) {
    throw new Error('Niche must define at least one outreachTemplate');
  }
  for (const template of outreachTemplates) {
    if (!template.body.trim()) throw new Error('Outreach template body cannot be empty');
  }
  return structuredClone(profile);
}

export class InMemoryNicheProfileRegistry {
  private readonly profiles = new Map<string, NicheProfile>();

  upsert(profile: NicheProfile): void {
    const validated = validateNicheProfile(profile);
    this.profiles.set(validated.id, validated);
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
  outreachTemplates: [
    {
      channel: 'whatsapp',
      language: 'bilingual',
      body: 'السلام عليكم فريق {{businessName}}،\n\nلاحظنا في تحليلنا الرقمي لخدمات العمرة أن موقعكم يواجه: "{{primaryProblem}}".\nنساعد المشغلين في مكة والمدينة على أتمتة حجوزات المعتمرين والدفع الإلكتروني المباشر (مدى / فيزا) وتوفير نظام متابعة ذكي.\n\nهل يناسبكم مكالمة قصيرة لمدة 10 دقائق لتأكيد نطاق العمل فقط — بدون وعود بنسبة تحويل؟',
    },
    {
      channel: 'email',
      language: 'en',
      subject: 'Partnership Opportunity for {{businessName}}: {{solutionTitle}}',
      body: 'Dear {{businessName}} Leadership Team,\n\nDuring a recent commercial market intelligence audit of service operators, we evaluated {{businessName}}\'s public customer discovery and booking workflow.\n\nKey Bottleneck Identified:\n• {{primaryProblem}}\n\nProposed Value Solution:\n• {{solutionTitle}}\n• Price and timeline only after a short call — no conversion percentage is claimed\n\nIf this gap is real on your side, I can walk the scope in 10 minutes.\n\nUmer Farooq\nfounder@umerfarooqtech.com\nhttps://umerfarooqtech.com',
    },
  ],
  placesTypes: ['travel_agency', 'lodging', 'tourist_attraction'],
});

export const CLINICS_HOSPITALS_NICHE: NicheProfile = validateNicheProfile({
  id: 'clinics-hospitals',
  name: 'Clinics & Hospitals',
  description: 'Healthcare facilities needing modern digital infrastructure: websites, online booking, patient portals, ERP systems, and payment integrations.',
  geographies: ['Karachi'], // Default geography; can be overridden via env OPPORTUNITY_NICHE_GEOGRAPHIES or UI
  status: 'testing',
  priority: 'high',
  targetBusinessesPerRun: 20,
  minimumOpportunityScore: 65,
  researchDepth: 'standard',
  problemHypotheses: [
    'No professional website or outdated non-mobile site reduces patient trust and discovery.',
    'Manual appointment booking via phone/WhatsApp creates inefficiency and missed bookings.',
    'No patient portal forces patients to visit in person for records, results, and follow-ups.',
    'Missing online payment and no HTTPS exposes patient data and blocks digital revenue.',
    'Lack of integrated clinic/hospital ERP causes administrative overhead and workflow bottlenecks.',
  ],
  discoverySignals: [
    'no website',
    'outdated website design',
    'non-mobile responsive site',
    'no online appointment booking',
    'no HTTPS',
    'slow website performance',
    'no patient portal',
    'WhatsApp-only booking',
    'poor reviews about appointment scheduling',
    'no online payment',
  ],
  allowedSolutionTypes: ['service', 'repeatable_service', 'product'],
  outreachMode: 'draft',
  createdAt: now,
  updatedAt: now,
  businessCategories: [
    'clinic',
    'hospital',
    'medical center',
    'dental clinic',
    'diagnostic laboratory',
    'specialty clinic',
    'primary care',
    'urgent care',
  ],
  discoveryQueries: [
    'clinic',
    'hospital',
    'dental clinic',
    'medical center',
    'diagnostic lab',
    'polyclinic',
  ],
  businessSignals: [
    'no website listed',
    'website is outdated or non-functional',
    'no online booking system visible',
    'appointment scheduling requires phone calls',
    'no secure patient portal',
    'website lacks HTTPS',
    'site performance is poor',
    'negative reviews mention appointment difficulty',
  ],
  revenueModels: [
    'website development project',
    'online booking system integration',
    'patient portal implementation',
    'ERP system deployment',
    'payment gateway integration',
    'ongoing maintenance retainer',
  ],
  acquisitionStrategies: [
    'website audit with specific findings',
    'online booking demo',
    'patient portal workflow presentation',
    'ERP system benefits overview',
    'security and compliance improvement offer',
  ],
  evidenceRequirements: [
    'business listing or website URL',
    'at least one concrete digital or operational gap',
    'source URL for each claim',
  ],
  outreachTemplates: [
    {
      channel: 'email',
      language: 'en',
      subject: 'Quick observation about {{businessName}}\'s online presence',
      body: 'Hi {{businessName}} team,\n\nI came across your practice while researching local healthcare providers. I noticed {{specificObservation}}.\n\nI\'ve worked on similar projects for medical facilities — {{concreteOffer}}. This typically improves patient experience and reduces administrative load.\n\nWould a brief 10-minute call this week work to discuss what might fit your needs?\n\nBest regards',
    },
  ],
  placesTypes: ['hospital', 'doctor', 'dentist', 'health', 'medical_lab'],
});

export const BUILTIN_NICHE_PROFILES: readonly NicheProfile[] = [SAUDI_UMRAH_NICHE, CLINICS_HOSPITALS_NICHE];
