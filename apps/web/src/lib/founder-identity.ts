export const UMER_FOUNDER_NAME = 'Umer Farooq';
export const UMER_FOUNDER_EMAIL = 'founder@umerfarooqtech.com';
export const UMER_SITE_URL = 'https://umerfarooqtech.com';
export const UMER_CAL_URL = 'https://cal.com/umer-farooq-gfnfzw/30min';
export const UMER_TITLE = 'Founder · systems that businesses are afraid to touch';

export function founderSignatureText(): string {
  return [
    UMER_FOUNDER_NAME,
    UMER_TITLE,
    UMER_FOUNDER_EMAIL,
    UMER_SITE_URL,
    `Book 15 min: ${UMER_CAL_URL}`,
  ].join('\n');
}

export function founderSignatureHtml(): string {
  return [
    `<p style="margin:0 0 12px;font-family:Georgia,serif;font-size:15px;color:#1a1208"><strong>${UMER_FOUNDER_NAME}</strong><br/>`,
    `<span style="color:#6b6256">${UMER_TITLE}</span></p>`,
    `<p style="margin:0;font-family:system-ui,sans-serif;font-size:13px;line-height:1.6;color:#3d3830">`,
    `<a href="mailto:${UMER_FOUNDER_EMAIL}" style="color:#b56a20">${UMER_FOUNDER_EMAIL}</a><br/>`,
    `<a href="${UMER_SITE_URL}" style="color:#b56a20">${UMER_SITE_URL.replace('https://', '')}</a><br/>`,
    `<a href="${UMER_CAL_URL}" style="color:#b56a20">Book 15 minutes</a>`,
    `</p>`,
  ].join('');
}
