import { createHash } from 'node:crypto';

export type IdentityCandidate = {
  externalId?: string;
  name: string;
  geography: string;
  websiteUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
};

export type IdentityMatch = 'DEFINITE_MATCH' | 'PROBABLE_MATCH' | 'POSSIBLE_MATCH' | 'DIFFERENT';

export type BusinessIdentity = {
  id: string;
  canonicalWebsite?: string;
  normalizedName: string;
  normalizedGeography: string;
  normalizedPhone?: string;
  normalizedEmail?: string;
  confidence: IdentityMatch;
  signals: string[];
};

const TRACKING_PARAMS = /^(utm_[a-z0-9_]+|fbclid|gclid|msclkid|dclid|mc_cid|mc_eid)$/i;

export function normalizeWebsite(url?: string): string | undefined {
  if (!url?.trim()) return undefined;
  try {
    const parsed = new URL(url.trim());
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    parsed.username = '';
    parsed.password = '';
    parsed.hash = '';

    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) parsed.searchParams.delete(key);
    }

    parsed.search = parsed.searchParams.toString();
    const cleanPath = parsed.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
    const port = parsed.port && !((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80'))
      ? `:${parsed.port}`
      : '';
    const query = parsed.searchParams.toString();
    return `${parsed.protocol}//${parsed.hostname}${port}${cleanPath}${query ? `?${query}` : ''}`;
  } catch {
    return undefined;
  }
}

export function normalizeBusinessName(name: string): string {
  return name
    .trim()
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u0640]/g, '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeGeography(geography: string): string {
  return geography.trim().normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizePhone(phone?: string, countryCode?: string): string | undefined {
  if (!phone?.trim()) return undefined;
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return undefined;
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (countryCode) {
    const countryDigits = countryCode.replace(/\D/g, '');
    if (countryDigits && digits.startsWith('0')) return `+${countryDigits}${digits.slice(1)}`;
    if (countryDigits && !digits.startsWith(countryDigits)) return `+${countryDigits}${digits}`;
  }
  return digits;
}

export function normalizeEmail(email?: string): string | undefined {
  if (!email?.trim()) return undefined;
  const value = email.trim().toLocaleLowerCase();
  return /^[^\s@]+@[^\s@]+$/.test(value) ? value : undefined;
}

function stableIdentityInput(candidate: IdentityCandidate): string {
  const website = normalizeWebsite(candidate.websiteUrl);
  const external = candidate.externalId?.trim().toLocaleLowerCase();
  const phone = normalizePhone(candidate.phone, candidate.countryCode);
  const email = normalizeEmail(candidate.email);
  const name = normalizeBusinessName(candidate.name);
  const geography = normalizeGeography(candidate.geography);

  if (external) return `external:${external}`;
  if (website) return `website:${new URL(website).hostname}`;
  if (phone && name) return `phone:${phone}|name:${name}`;
  if (email) return `email:${email}`;
  return `name:${name}|geo:${geography}`;
}

export function createBusinessId(candidate: IdentityCandidate): string {
  return createHash('sha256').update(stableIdentityInput(candidate)).digest('hex');
}

export function resolveIdentity(a: IdentityCandidate, b: IdentityCandidate): IdentityMatch {
  const aExternal = a.externalId?.trim().toLocaleLowerCase();
  const bExternal = b.externalId?.trim().toLocaleLowerCase();
  if (aExternal && bExternal) return aExternal === bExternal ? 'DEFINITE_MATCH' : 'DIFFERENT';

  const aWebsite = normalizeWebsite(a.websiteUrl);
  const bWebsite = normalizeWebsite(b.websiteUrl);
  if (aWebsite && bWebsite && new URL(aWebsite).hostname === new URL(bWebsite).hostname) return 'DEFINITE_MATCH';

  const aPhone = normalizePhone(a.phone, a.countryCode);
  const bPhone = normalizePhone(b.phone, b.countryCode);
  if (aPhone && bPhone && aPhone === bPhone) return normalizeBusinessName(a.name) === normalizeBusinessName(b.name) ? 'DEFINITE_MATCH' : 'PROBABLE_MATCH';

  const aEmail = normalizeEmail(a.email);
  const bEmail = normalizeEmail(b.email);
  if (aEmail && bEmail && aEmail === bEmail) return 'DEFINITE_MATCH';

  const sameName = normalizeBusinessName(a.name) === normalizeBusinessName(b.name);
  const sameGeo = normalizeGeography(a.geography) === normalizeGeography(b.geography);
  if (sameName && sameGeo) return 'PROBABLE_MATCH';
  if (sameName) return 'POSSIBLE_MATCH';
  return 'DIFFERENT';
}

export function buildBusinessIdentity(candidate: IdentityCandidate): BusinessIdentity {
  const normalizedWebsite = normalizeWebsite(candidate.websiteUrl);
  const normalizedPhone = normalizePhone(candidate.phone, candidate.countryCode);
  const normalizedEmail = normalizeEmail(candidate.email);
  const signals: string[] = [];
  if (candidate.externalId?.trim()) signals.push('external_id');
  if (normalizedWebsite) signals.push('canonical_domain');
  if (normalizedPhone) signals.push('phone');
  if (normalizedEmail) signals.push('email');
  if (candidate.address?.trim()) signals.push('address');
  signals.push('name', 'geography');

  const confidence: IdentityMatch = candidate.externalId?.trim() || normalizedWebsite
    ? 'DEFINITE_MATCH'
    : normalizedPhone || normalizedEmail
      ? 'PROBABLE_MATCH'
      : 'POSSIBLE_MATCH';

  return {
    id: createBusinessId(candidate),
    canonicalWebsite: normalizedWebsite,
    normalizedName: normalizeBusinessName(candidate.name),
    normalizedGeography: normalizeGeography(candidate.geography),
    normalizedPhone,
    normalizedEmail,
    confidence,
    signals,
  };
}
