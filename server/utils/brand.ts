import type { H3Event } from 'h3';

/**
 * Brand identity bundled into every transactional email.
 *
 * Sourced from `runtimeConfig.public.brand` (env-driven via `NUXT_PUBLIC_BRAND_*`).
 * Email templates reference these via Handlebars vars — they're never hard-coded
 * in MJML, so a brand refresh is one env var away.
 */
export interface BrandContext {
  logoUrl: string;
  companyName: string;
  legalName: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
  websiteUrl: string;
  websiteLabel: string;
  supportEmail: string;
  replyToEmail: string;
  termsUrl: string;
  taglineFr: string;
  taglineEn: string;
  iban: string;
  bic: string;
  bankName: string;
  signatureName: string;
}

export function getBrand(event?: H3Event): BrandContext {
  const cfg = useRuntimeConfig(event);
  return cfg.public.brand as BrandContext;
}

/**
 * Flatten the brand context into the Handlebars params namespace.
 * Keys are prefixed with `brand_` to avoid collisions with kind-specific vars
 * and `brand_tagline` is resolved by language.
 */
export function brandToHandlebarsParams(
  brand: BrandContext,
  language: 'fr' | 'en',
): Record<string, string> {
  const cityLine = [brand.postalCode, brand.city].filter(Boolean).join(' ');
  const addressLines = [brand.addressLine1, brand.addressLine2, cityLine, brand.country]
    .filter(Boolean);
  return {
    brand_logo_url: brand.logoUrl,
    brand_company_name: brand.companyName,
    brand_legal_name: brand.legalName,
    brand_address_line1: brand.addressLine1,
    brand_address_line2: brand.addressLine2,
    brand_postal_code: brand.postalCode,
    brand_city: brand.city,
    brand_country: brand.country,
    brand_address_html: addressLines.join('<br/>'),
    brand_address_text: addressLines.join(', '),
    brand_phone: brand.phone,
    brand_website_url: brand.websiteUrl,
    brand_website_label: brand.websiteLabel,
    brand_support_email: brand.supportEmail,
    brand_reply_to_email: brand.replyToEmail,
    brand_terms_url: brand.termsUrl,
    brand_tagline: language === 'en' ? brand.taglineEn : brand.taglineFr,
    brand_iban: brand.iban,
    brand_bic: brand.bic,
    brand_bank_name: brand.bankName,
    brand_signature_name: brand.signatureName,
  };
}
