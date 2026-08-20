import { listWaitlist } from '../admin/store.js'
import { sendBlogPublishedEmail } from '../mail/appEmails.js'
import { normalizeEmail } from '../mail/emailAddress.js'
import { mailUrls } from '../mail/layout.js'
import { markBlogNotified, type CmsBlog } from './blogStore.js'

export async function notifyUsersNewBlog(blog: CmsBlog): Promise<{ sent: number; failed: number; total: number }> {
  const rows = await listWaitlist({ status: 'all' })
  const seen = new Set<string>()
  const recipients = rows
    .filter((r) => r.status !== 'rejected')
    .map((r) => ({ email: normalizeEmail(r.email), fullName: r.fullName }))
    .filter((r) => {
      if (!r.email || seen.has(r.email)) return false
      seen.add(r.email)
      return true
    })

  const url = `${mailUrls().landing}/blog/${blog.slug}`
  let sent = 0
  let failed = 0

  for (const r of recipients) {
    const result = await sendBlogPublishedEmail({
      to: r.email,
      fullName: r.fullName,
      title: blog.title,
      excerpt: blog.excerpt,
      url,
    })
    if (result.sent) sent += 1
    else failed += 1
  }

  await markBlogNotified(blog.id)
  return { sent, failed, total: recipients.length }
}
