import { randomUUID } from 'node:crypto';
import type {
  BusinessProspect,
  EvidenceRecord,
  NicheDefinition,
  Opportunity,
  OutreachDraft,
  Problem,
} from '@umer/contracts';

export type OutreachGeneratorInput = {
  opportunity: Opportunity;
  business: BusinessProspect;
  problems: Problem[];
  evidence: EvidenceRecord[];
  niche: NicheDefinition;
};

export interface OutreachGenerator {
  generateDrafts(input: OutreachGeneratorInput): Promise<OutreachDraft[]>;
}

export class DefaultOutreachGenerator implements OutreachGenerator {
  async generateDrafts(input: OutreachGeneratorInput): Promise<OutreachDraft[]> {
    const { opportunity, business, problems, evidence, niche } = input;
    const drafts: OutreachDraft[] = [];
    const now = new Date().toISOString();

    const primaryProblem = problems[0]?.statement ?? 'manual operational workflow friction';
    const hasArabicContext = niche.geographies.some((g) => ['Makkah', 'Madinah', 'Jeddah', 'Saudi Arabia', 'Riyadh'].includes(g));

    // 1. WhatsApp Outreach Draft (Primary GCC & Saudi Conversion Channel)
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

    // 2. Email Executive Proposal Draft
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

    return drafts;
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
