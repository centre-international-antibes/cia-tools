/**
 * Brand color & typography tokens used by the MJML layout.
 * Single source of truth for header/footer/CTA styling. Kept in plain
 * strings so they can be interpolated into MJML attributes directly.
 */
export const EMAIL_TOKENS = {
  color: {
    primary: '#156082',
    primaryDark: '#0f4860',
    text: '#1f2937',
    muted: '#6b7280',
    surface: '#ffffff',
    surfaceMuted: '#f9fafb',
    border: '#e5e7eb',
    danger: '#b91c1c',
    dangerSoft: '#fef2f2',
  },
  font: {
    family: "'Helvetica Neue', Arial, 'Liberation Sans', sans-serif",
    sizeBody: '15px',
    sizeSmall: '13px',
    sizeTitle: '20px',
    lineHeight: '1.55',
  },
  layout: {
    width: '600px',
  },
} as const;

export type EmailTokens = typeof EMAIL_TOKENS;
