import DOMPurify from 'dompurify'

/** Sanitize HTML content before rendering via dangerouslySetInnerHTML.
 *  ponytail: covers stored-XSS from admin-authored blog content. */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
  })
}
