import { randomUUID } from 'node:crypto';
import type {
  BusinessProspect,
  EvidenceRecord,
  NicheDefinition,
  Opportunity,
  OutreachDraft,
  Problem,
} from '@umer/contracts';
import type { NicheProfile } from './niche-profiles.js';

export type OutreachGeneratorInput = {
  opportunity: Opportunity;
  business: BusinessProspect;
  problems: Problem[];
  evidence: EvidenceRecord[];
  niche: NicheDefinition;
  nicheProfile?: NicheProfile;
};

export interface OutreachGenerator {
  generateDrafts(input: OutreachGeneratorInput): Promise<OutreachDraft[]>;
}

export class DefaultOutreachGenerator implements OutreachGenerator {
  async generateDrafts(input: OutreachGeneratorInput): Promise<OutreachDraft[]> {
    const { nicheProfile } = input;
    
    if (nicheProfile?.outreachTemplates) {
      return this.generateFromTemplates(input, nicheProfile);
    }
    
    return this.generateLegacy(input);
  }

  private async generateFromTemplates(
    input: OutreachGeneratorInput,
    nicheProfile: NicheProfile,
  ): Promise<OutreachDraft[]> {
    const { opportunity, business, problems, evidence, niche } = input;
    const drafts: OutreachDraft[] = [];
    const now = new Date().toISOString();
    const primaryProblem = problems[0]?.statement ?? 'manual operational workflow friction';

    for (const template of nicheProfile.outreachTemplates) {
      const body = this.renderTemplate(template.body, {
        businessName: business.name,
        primaryProblem,
        solutionTitle: opportunity.title,
        specificObservation: this.extractSpecificObservation(evidence, primaryProblem),
        concreteOffer: this.buildConcreteOffer(niche, business),
      });

      const subject = template.subject
        ? this.renderTemplate(template.subject, {
            businessName: business.name,
            primaryProblem,
            solutionTitle: opportunity.title,
          })
        : undefined;

      drafts.push({
        id: randomUUID(),
        opportunityId: opportunity.id,
        businessId: business.id,
        nicheId: niche.id,
        channel: template.channel,
        recipient: this.extractRecipient(business, template.channel),
        subject,
        body,
        language: template.language,
        valueProposition: `Fix the recorded gap: ${primaryProblem}`,
        evidenceRefs: evidence.map((e) => e.id),
        status: 'drafted',
        createdAt: now,
        updatedAt: now,
      });
    }

    return drafts;
  }

  private renderTemplate(template: string, vars: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  }

  private extractSpecificObservation(evidence: EvidenceRecord[], fallback: string): string {
    const websiteEvidence = evidence.find((e) => e.type === 'website' && e.observation);
    if (websiteEvidence) {
      const obs = websiteEvidence.observation;
      if (obs.includes('no website') || obs.includes('without a registered website')) {
        return 'you currently operate without a professional website';
      }
      if (obs.includes('no online booking') || obs.includes('booking engine')) {
        return 'your site lacks online appointment booking';
      }
      if (obs.includes('no online checkout') || obs.includes('no online payment')) {
        return 'there\'s no online payment system visible';
      }
      if (obs.includes('HTTP') && obs.includes('status')) {
        return 'your website appears to have availability issues';
      }
      return obs.split('.')[0].toLowerCase();
    }
    return fallback;
  }

  private buildConcreteOffer(niche: NicheDefinition, business: BusinessProspect): string {
    const industry = business.industry?.toLowerCase() || '';
    
    if (industry.includes('clinic') || industry.includes('hospital') || industry.includes('medical') || industry.includes('dental')) {
      if (!business.website) {
        return 'modern websites with online booking and patient portals';
      }
      return 'online appointment systems, patient portals, and secure payment integrations';
    }
    
    if (niche.name.toLowerCase().includes('umrah') || niche.name.toLowerCase().includes('travel')) {
      return 'automated booking engines, payment integration, and CRM workflows';
    }
    
    return 'modern web solutions, online booking, and payment systems';
  }

  private extractRecipient(business: BusinessProspect, channel: 'whatsapp' | 'email'): string | undefined {
    if (channel === 'email') {
      return this.extractEmail(business);
    }
    return this.extractPhone(business);
  }

  private generateLegacy(input: OutreachGeneratorInput): Promise<OutreachDraft[]> {
    const { opportunity, business, problems, evidence, niche } = input;
    const drafts: OutreachDraft[] = [];
    const now = new Date().toISOString();

    const primaryProblem = problems[0]?.statement ?? 'manual operational workflow friction';
    const hasArabicContext = niche.geographies.some((g) => ['Makkah', 'Madinah', 'Jeddah', 'Saudi Arabia', 'Riyadh'].includes(g));

    const waBody = this.buildWhatsAppPitch(business.name, primaryProblem, hasArabicContext);
    drafts.push({
      id: randomUUID(),
      opportunityId: opportunity.id,
      businessId: business.id,
      nicheId: niche.id,
      channel: 'whatsapp',
      recipient: this.extractPhone(business),
      body: waBody,
      language: hasArabicContext ? 'bilingual' : 'en',
      valueProposition: `Fix the recorded gap: ${primaryProblem}`,
      evidenceRefs: evidence.map((e) => e.id),
      status: 'drafted',
      createdAt: now,
      updatedAt: now,
    });

    const emailDraft = this.buildEmailPitch(business.name, primaryProblem, opportunity.title);
    drafts.push({
      id: randomUUID(),
      opportunityId: opportunity.id,
      businessId: business.id,
      nicheId: niche.id,
      channel: 'email',
      recipient: this.extractEmail(business),
      subject: emailDraft.subject,
      body: emailDraft.body,
      language: 'en',
      valueProposition: `Scoped job: ${opportunity.title}. No invented conversion lift.`,
      evidenceRefs: evidence.map((e) => e.id),
      status: 'drafted',
      createdAt: now,
      updatedAt: now,
    });

    return Promise.resolve(drafts);
  }

  private buildWhatsAppPitch(businessName: string, primaryProblem: string, isSaudi: boolean): string {
    if (isSaudi) {
      return (
        `السلام عليكم فريق ${businessName}،\n\n` +
        `لاحظنا في تحليلنا الرقمي لخدمات العمرة أن موقعكم يواجه: "${primaryProblem}".\n` +
        `نساعد المشغلين في مكة والمدينة على أتمتة حجوزات المعتمرين والدفع الإلكتروني المباشر (مدى / فيزا) وتوفير نظام متابعة ذكي.\n\n` +
        `هل يناسبكم مكالمة قصيرة لمدة 10 دقائق لتأكيد نطاق العمل فقط — بدون وعود بنسبة تحويل؟`
      );
    }
    return (
      `Hi ${businessName} team,\n\n` +
      `We audited your digital front and identified an immediate growth opportunity: "${primaryProblem}".\n` +
      `We help operators automate self-service bookings and direct payment checkout to reduce customer drop-off.\n\n` +
      `Would you be open to a quick 5-minute walkthrough this week?`
    );
  }

  private buildEmailPitch(businessName: string, primaryProblem: string, solutionTitle: string): { subject: string; body: string } {
    const subject = `Partnership Opportunity for ${businessName}: ${solutionTitle}`;
    const body = (
      `Dear ${businessName} Leadership Team,\n\n` +
      `During a recent commercial market intelligence audit of service operators, we evaluated ${businessName}'s public customer discovery and booking workflow.\n\n` +
      `Key Bottleneck Identified:\n` +
      `• ${primaryProblem}\n\n` +
      `Proposed Value Solution:\n` +
      `• ${solutionTitle}\n` +
      `• Price and timeline only after a short call — no conversion percentage is claimed\n\n` +
      `If this gap is real on your side, I can walk the scope in 10 minutes.\n\n` +
      `Umer Farooq\n` +
      `founder@umerfarooqtech.com\n` +
      `https://umerfarooqtech.com`
    );
    return { subject, body };
  }

  private extractPhone(business: BusinessProspect): string | undefined {
    const ref = business.sourceRefs.find((r) => r.startsWith('phone:'));
    return ref ? ref.replace('phone:', '').trim() : undefined;
  }

  private extractEmail(business: BusinessProspect): string | undefined {
    const ref = business.sourceRefs.find((r) => r.startsWith('email:'));
    return ref ? ref.replace('email:', '').trim() : undefined;
  }
}
