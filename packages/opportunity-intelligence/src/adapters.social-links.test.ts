import { describe, expect, it } from 'vitest';
import { extractSocialLinks } from './adapters.js';

describe('extractSocialLinks', () => {
  it('finds real profile links in a footer', () => {
    const html = `
      <footer>
        <a href="https://www.facebook.com/rawdahpilgrimservices">Facebook</a>
        <a href="https://www.instagram.com/rawdahpilgrim/">Instagram</a>
        <a href="https://x.com/rawdahpilgrim">Twitter</a>
        <a href="https://www.linkedin.com/company/rawdah-pilgrim-services">LinkedIn</a>
      </footer>
    `;
    const links = new Map(extractSocialLinks(html));
    expect(links.get('facebook')).toBe('https://www.facebook.com/rawdahpilgrimservices');
    expect(links.get('instagram')).toBe('https://www.instagram.com/rawdahpilgrim/');
    expect(links.get('twitter')).toBe('https://x.com/rawdahpilgrim');
    expect(links.get('linkedin')).toBe('https://www.linkedin.com/company/rawdah-pilgrim-services');
  });

  it('ignores share buttons, login links, and bare homepage links', () => {
    const html = `
      <a href="https://www.facebook.com/sharer.php?u=https://example.com">Share</a>
      <a href="https://www.facebook.com/">Facebook</a>
      <a href="https://www.instagram.com/accounts/login/">Login</a>
      <a href="https://www.instagram.com/p/Cabc123/">A post, not a profile</a>
      <a href="https://twitter.com/intent/tweet?text=hi">Tweet this</a>
    `;
    expect(extractSocialLinks(html)).toEqual([]);
  });

  it('takes the first real match per platform and ignores the rest', () => {
    const html = `
      <a href="https://www.facebook.com/business-a">First</a>
      <a href="https://www.facebook.com/business-b">Second, should be ignored</a>
    `;
    const links = new Map(extractSocialLinks(html));
    expect(links.get('facebook')).toBe('https://www.facebook.com/business-a');
  });

  it('returns nothing when the page has no social links', () => {
    expect(extractSocialLinks('<html><body>No social links here.</body></html>')).toEqual([]);
  });
});
