import { EMAIL_TOKENS } from './tokens';

/**
 * MJML fragments composed into per-kind templates.
 *
 * Everything is pure string composition: Handlebars vars survive as-is
 * because MJML compilation is a string-to-string pass. No emojis, no
 * decorative imagery beyond the header logo — this prioritizes
 * deliverability and consistent rendering across Outlook / Apple Mail.
 */

const c = EMAIL_TOKENS.color;
const f = EMAIL_TOKENS.font;

/** Centered primary CTA button. */
export function paymentCtaButton(label: string, href = '{{payment_url}}'): string {
  return `
    <mj-button
      href="${href}"
      background-color="${c.primary}"
      color="${c.surface}"
      font-size="${f.sizeBody}"
      font-weight="600"
      padding="20px 0"
      inner-padding="14px 32px"
      border-radius="6px"
    >${label}</mj-button>
  `;
}

/** Compact bank-transfer block rendered from brand vars. */
export function bankBlock(label: string): string {
  return `
    <mj-text
      font-family="${f.family}"
      font-size="${f.sizeSmall}"
      line-height="${f.lineHeight}"
      color="${c.text}"
      padding="8px 24px"
    >
      <strong>${label}</strong><br/>
      {{brand_legal_name}}<br/>
      {{brand_address_line1}}<br/>
      {{brand_postal_code}} {{brand_city}}<br/>
      <br/>
      <strong>IBAN:</strong> {{brand_iban}}<br/>
      <strong>SWIFT (BIC):</strong> {{brand_bic}}
    </mj-text>
  `;
}

/** Red-tinted urgent banner for late-stage payment reminders. */
export function urgentBanner(text: string): string {
  return `
    <mj-section background-color="${c.dangerSoft}" padding="12px 24px">
      <mj-column>
        <mj-text
          font-family="${f.family}"
          font-size="${f.sizeBody}"
          font-weight="700"
          color="${c.danger}"
          align="center"
        >${text}</mj-text>
      </mj-column>
    </mj-section>
  `;
}

/**
 * Bulleted checklist rendered from a server-built `missing_documents` array.
 * Empty arrays render nothing (the `{{#if}}` guards the caller's surrounding
 * intro paragraph).
 */
export function documentChecklist(): string {
  return `
    <mj-text
      font-family="${f.family}"
      font-size="${f.sizeBody}"
      line-height="${f.lineHeight}"
      color="${c.text}"
      padding="0 24px"
    >
      {{#if missing_documents.length}}
      <ul style="padding-left: 18px; margin: 0;">
        {{#each missing_documents}}
        <li style="margin-bottom: 6px;">{{label}}{{#if url}} — <a href="{{url}}" style="color: ${c.primary};">{{url}}</a>{{/if}}</li>
        {{/each}}
      </ul>
      {{/if}}
    </mj-text>
  `;
}

/** A short paragraph rendered with the standard body styling. */
export function paragraph(content: string): string {
  return `
    <mj-text
      font-family="${f.family}"
      font-size="${f.sizeBody}"
      line-height="${f.lineHeight}"
      color="${c.text}"
      padding="6px 24px"
    >${content}</mj-text>
  `;
}

/** Section heading rendered inside a body section. */
export function heading(content: string): string {
  return `
    <mj-text
      font-family="${f.family}"
      font-size="${f.sizeTitle}"
      font-weight="600"
      color="${c.text}"
      padding="16px 24px 4px"
    >${content}</mj-text>
  `;
}
