import { EMAIL_TOKENS } from './tokens';

/**
 * Shared MJML wrapper for every transactional email.
 *
 * Layout: header (logo) → body slot → footer (signature + address + legal).
 * Single column, 600px max width. All copy and assets are sourced from
 * Handlebars vars (`brand_*`) injected by the sender at render time.
 *
 * Deliverability rules:
 *   - System font stack only (no Google Fonts to avoid render-time fetches).
 *   - No emojis, no inline scripts, no remote stylesheets.
 *   - Plain-text preheader populated for inbox previews.
 *   - One outbound link domain (brand website) keeps SpamAssassin happy.
 */
export interface WrapMjmlLayoutOptions {
  /** Inbox preview line. Falls back to a generic brand string. */
  preheader: string;
  /** Body MJML — must contain `<mj-section>` blocks, not the root tags. */
  bodyMjml: string;
  /** Locale; only used to pick which signature label to render. */
  language: 'fr' | 'en';
  /** Optional document title (defaults to brand company name). */
  title?: string;
}

const c = EMAIL_TOKENS.color;
const f = EMAIL_TOKENS.font;

function header(): string {
  return `
    <mj-section background-color="${c.surface}" padding="24px 24px 12px">
      <mj-column>
        <mj-image
          src="{{brand_logo_url}}"
          alt="{{brand_company_name}}"
          width="180px"
          align="center"
          padding="0"
        />
      </mj-column>
    </mj-section>
    <mj-section background-color="${c.surface}" padding="0 24px 8px">
      <mj-column>
        <mj-divider border-color="${c.primary}" border-width="2px" padding="0" />
      </mj-column>
    </mj-section>
  `;
}

function footer(language: 'fr' | 'en'): string {
  const labels = language === 'fr'
    ? {
      regards: 'Cordialement,',
      address: 'Adresse',
      phone: 'T\u00e9l\u00e9phone',
      web: 'Site web',
      email: 'E-mail',
      unsubscribe: 'Se d\u00e9sinscrire',
    }
    : {
      regards: 'Best regards,',
      address: 'Address',
      phone: 'Phone',
      web: 'Website',
      email: 'Email',
      unsubscribe: 'Unsubscribe',
    };

  return `
    <mj-section background-color="${c.surface}" padding="16px 24px 0">
      <mj-column>
        <mj-divider border-color="${c.border}" border-width="1px" padding="0" />
      </mj-column>
    </mj-section>
    <mj-section background-color="${c.surface}" padding="16px 24px 8px">
      <mj-column>
        <mj-text
          font-family="${f.family}"
          font-size="${f.sizeBody}"
          line-height="${f.lineHeight}"
          color="${c.text}"
          padding="0"
        >
          ${labels.regards}<br/>
          <strong>{{brand_signature_name}}</strong><br/>
          {{brand_company_name}}
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="${c.surface}" padding="8px 24px 24px">
      <mj-column>
        <mj-text
          font-family="${f.family}"
          font-size="${f.sizeSmall}"
          line-height="${f.lineHeight}"
          color="${c.muted}"
          padding="0"
        >
          ${labels.address}: {{brand_address_text}}<br/>
          ${labels.phone}: {{brand_phone}}<br/>
          ${labels.web}: <a href="{{brand_website_url}}" style="color: ${c.primary};">{{brand_website_label}}</a><br/>
          ${labels.email}: <a href="mailto:{{brand_support_email}}" style="color: ${c.primary};">{{brand_support_email}}</a>
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="${c.surfaceMuted}" padding="12px 24px">
      <mj-column>
        <mj-text
          font-family="${f.family}"
          font-size="11px"
          line-height="1.5"
          color="${c.muted}"
          align="center"
          padding="0"
        >
          {{brand_tagline}}<br/>
          <a href="{unsubscribe}" style="color: ${c.muted};">${labels.unsubscribe}</a>
        </mj-text>
      </mj-column>
    </mj-section>
  `;
}

export function wrapMjmlLayout(opts: WrapMjmlLayoutOptions): string {
  const title = opts.title ?? '{{brand_company_name}}';
  return `<mjml>
  <mj-head>
    <mj-title>${escapeMjmlAttr(title)}</mj-title>
    <mj-preview>${escapeMjmlAttr(opts.preheader)}</mj-preview>
    <mj-attributes>
      <mj-all font-family="${f.family}" />
      <mj-text font-size="${f.sizeBody}" line-height="${f.lineHeight}" color="${c.text}" />
      <mj-section background-color="${c.surface}" />
    </mj-attributes>
    <mj-style inline="inline">
      a { text-decoration: none; }
      a:hover { text-decoration: underline; }
    </mj-style>
  </mj-head>
  <mj-body background-color="${c.surfaceMuted}" width="${EMAIL_TOKENS.layout.width}">
    ${header()}
    ${opts.bodyMjml}
    ${footer(opts.language)}
  </mj-body>
</mjml>`;
}

/** Escape characters that would break out of an MJML attribute value. */
function escapeMjmlAttr(value: string): string {
  return value.replace(/"/g, '&quot;');
}
