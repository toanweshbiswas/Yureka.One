import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import {
  landingCaption,
  landingContainer,
  landingEyebrow,
  landingLink,
  landingSection,
  landingSectionTitle,
} from './landingLayout';
import { api, isApiError } from '@backend/lib/api/client'
import { fromApiBlog } from '@backend/lib/api/mappers'
import type { Blog as ApiBlog } from '@backend/lib/api/types'
import type { Blog } from '@/types'

export default function JournalSection() {
  const [posts, setPosts] = useState<Blog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .get<ApiBlog[]>('/api/v1/cms/blogs', { skipAuth: true })
      .then((res) => {
        if (cancelled || isApiError(res)) return
        const published = (res.data ?? [])
          .map(fromApiBlog)
          .filter((post) => post.status !== 'draft')
        setPosts(published.slice(0, 3))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className={landingSection}>
      <div className={landingContainer}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
          <div>
            <p className={`mb-4 ${landingEyebrow}`}>Blog</p>
            <h2 className={landingSectionTitle}>
              Spend smarter. Read first.
            </h2>
          </div>
          <Link
            to="/blog"
            className={`inline-flex items-center gap-2 text-[14px] ${landingLink}`}
          >
            All articles <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden animate-pulse"
              >
                <div className="aspect-[16/9] bg-white/5" />
                <div className="p-6 space-y-3">
                  <div className="h-3 w-20 rounded bg-white/10" />
                  <div className="h-5 w-full rounded bg-white/10" />
                  <div className="h-4 w-[80%] rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {posts.map((post) => (
              <Link
                key={post.id || post.slug}
                to={`/blog/${post.slug}`}
                className="group rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden hover:border-white/20 transition-colors"
              >
                {post.image ? (
                  <div className="aspect-[16/9] overflow-hidden">
                    <img
                      src={post.image}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/9] bg-gradient-to-br from-landing-primary/25 to-white/5" />
                )}
                <div className="p-6 space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-landing-primary/80">{post.category || 'Blog'}</p>
                  <h3 className="text-[18px] font-medium tracking-[-0.02em] text-landing-sub group-hover:text-landing-primary transition-colors leading-snug">
                    {post.title}
                  </h3>
                  {post.excerpt ? (
                    <p className={`${landingCaption} line-clamp-2`}>{post.excerpt}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Link
            to="/blog"
            className="block rounded-3xl border border-white/10 bg-white/[0.03] p-10 sm:p-14 hover:border-white/20 transition-colors"
          >
            <p className="text-[13px] uppercase tracking-[0.2em] text-landing-primary/80 mb-4">Yureka Editorial</p>
            <p className="text-[22px] sm:text-[28px] font-light tracking-[-0.02em] text-landing-sub max-w-xl">
              Credit, gold, and spending. written for people who actually shop.
            </p>
            <p className={`mt-6 inline-flex items-center gap-2 text-[14px] ${landingLink}`}>
              Open the blog <ArrowRight size={14} />
            </p>
          </Link>
        )}
      </div>
    </section>
  )
}
