import { describe, expect, it } from 'vitest';
import { extractLiveSeo, liveSeoSentence } from './seo-live';

describe('seo-live', () => {
  it('reads title, description and canonical from HTML', () => {
    const html = `<html><head><title>I rebuild systems</title><meta name="description" content="ERP and ticketing"><link rel="canonical" href="https://umerfarooqtech.com/"></head></html>`;
    const signals = extractLiveSeo(html, 'https://umerfarooqtech.com/');
    expect(signals.title).toBe('I rebuild systems');
    expect(signals.description).toBe('ERP and ticketing');
    expect(signals.hasCanonical).toBe(true);
    expect(signals.https).toBe(true);
  });

  it('does not invent Search Console numbers when the site is down', () => {
    const sentence = liveSeoSentence({
      url: 'https://toolworks.app',
      reachable: false,
      title: null,
      description: null,
      hasCanonical: false,
      https: true,
    });
    expect(sentence).toMatch(/did not respond/i);
    expect(sentence).not.toMatch(/\d+ clicks|position/i);
  });
});
