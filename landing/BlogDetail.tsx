import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft, Share2, Bookmark, Clock,
    BookOpen, Loader2, ChevronUp
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, isApiError } from '@backend/lib/api/client';
import { fromApiBlog } from '@backend/lib/api/mappers';
import { sanitizeHtml } from '@shared/sanitize';
import type { Blog as ApiBlog } from '@backend/lib/api/types';
import { Blog } from '@/types';
import ImageWithLoader from '@shared/ImageWithLoader';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import SEO from '@shared/SEO';
import { blogPostingSchema, breadcrumbSchema } from '@backend/lib/seo/structuredData';
import NotFoundPage from '@landing/NotFoundPage';

const spring = { type: 'spring' as const, bounce: 0, duration: 0.4 };

const BlogDetail: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const reduceMotion = useReducedMotion();
    const [blog, setBlog] = useState<Blog | null>(null);
    const [related, setRelated] = useState<Blog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [readingProgress, setReadingProgress] = useState(0);
    const [bookmarked, setBookmarked] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [extractedHtml, setExtractedHtml] = useState<string | null>(null);
    const [isReaderLoading, setIsReaderLoading] = useState(false);
    const articleRef = useRef<HTMLDivElement>(null);

    const blogSchemas = blog
        ? [
              breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }, { name: blog.title, path: `/blog/${blog.slug || slug}` }]),
              blogPostingSchema({ title: blog.title, image: blog.image, createdAt: blog.created_at, updatedAt: blog.updated_at, author: blog.author, slug: blog.slug || slug }),
          ]
        : undefined;

    useEffect(() => {
        if (!slug) return;
        setIsLoading(true);
        setExtractedHtml(null);

        const fetchBlog = async () => {
            const res = await api.get<ApiBlog>(`/api/v1/cms/blogs/${slug}`, { skipAuth: true });
            const data: Blog | null = !isApiError(res) && res.data ? fromApiBlog(res.data) : null;

            setBlog(data);
            setIsLoading(false);

            if (data) {
                const allRes = await api.get<ApiBlog[]>('/api/v1/cms/blogs', { skipAuth: true });
                if (!isApiError(allRes)) {
                    setRelated((allRes.data ?? []).map(fromApiBlog).filter(b => b.id !== data!.id && b.category === data!.category).slice(0, 3));
                }

                if (data.external_link) {
                    setIsReaderLoading(true);
                    try {
                        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(data.external_link)}`;
                        const response = await fetch(proxyUrl);
                        const result = await response.json();
                        const html = result.contents;

                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');

                        const selectors = [
                            '.post-body',
                            '[itemprop="articleBody"]',
                            'article',
                            '.entry-content',
                            '.main-content',
                            '.post-content'
                        ];

                        let mainContent = null;
                        for (const selector of selectors) {
                            mainContent = doc.querySelector(selector);
                            if (mainContent) break;
                        }

                        if (!mainContent) {
                            const allDivs = Array.from(doc.querySelectorAll('div, section, article'));
                            let maxText = 0;
                            let bestEl = null;
                            allDivs.forEach(el => {
                                const textLen = el.textContent?.trim().length || 0;
                                if (textLen > maxText) {
                                    maxText = textLen;
                                    bestEl = el;
                                }
                            });
                            if (bestEl && maxText > 500) mainContent = bestEl;
                        }

                        if (mainContent) {
                            const clutter = [
                                'header', 'footer', 'nav', '.navbar', '#navbar',
                                '.post-footer', '.blog-pager', '.comments', '#comments',
                                '.attribution', '.sharing-buttons', '.share-buttons',
                                '.social-sharing', '.footer-outer', '.header-outer',
                                '.adsbygoogle', 'script', 'style', 'iframe'
                            ];
                            clutter.forEach(s => {
                                mainContent?.querySelectorAll(s).forEach(el => el.remove());
                            });

                            const baseUrl = new URL(data.external_link).origin;
                            mainContent.querySelectorAll('img, a').forEach(el => {
                                if (el instanceof HTMLImageElement) {
                                    const src = el.getAttribute('src');
                                    if (src && !src.startsWith('http')) el.setAttribute('src', new URL(src, baseUrl).href);
                                }
                                if (el instanceof HTMLAnchorElement) {
                                    const href = el.getAttribute('href');
                                    if (href && !href.startsWith('http')) el.setAttribute('href', new URL(href, baseUrl).href);
                                }
                            });

                            setExtractedHtml(mainContent.innerHTML);
                        }
                    } catch (err) {
                        console.warn("Reader mode extraction failed:", err);
                    } finally {
                        setIsReaderLoading(false);
                    }
                }
            }
        };
        fetchBlog();
        window.scrollTo(0, 0);
    }, [slug]);

    useEffect(() => {
        const handleScroll = () => {
            const el = articleRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const totalHeight = el.offsetHeight;
            const scrolled = Math.max(0, -rect.top);
            const progress = Math.min(100, (scrolled / totalHeight) * 100);
            setReadingProgress(progress);
            setShowScrollTop(window.scrollY > 600);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {}
    };

    if (isLoading) {
        return (
            <div className="blog-reading min-h-screen bg-landing-bg flex items-center justify-center">
                <div className="space-y-4 text-center">
                    <div className="w-10 h-10 border-2 border-landing-primary/30 border-t-landing-primary rounded-full animate-spin mx-auto" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">Opening article</p>
                </div>
            </div>
        );
    }

    if (!blog) {
        return <NotFoundPage />;
    }

    const wordCount = (blog.content || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    const readTime = blog.read_time || `${Math.ceil(wordCount / 200)} min read`;
    const isHtml = blog.content_format === 'html' || /<\/?[a-z][\s\S]*>/i.test(blog.content || '');

    return (
        <div className="blog-reading min-h-screen bg-landing-bg pb-28 selection:bg-landing-primary selection:text-landing-ink" ref={articleRef}>
            <SEO
                title={`${blog.title} | Yureka Blog`}
                description={blog.excerpt || `Read the latest insights on ${blog.category} from ${blog.author}.`}
                image={blog.image}
                schema={blogSchemas}
            />

            <div
                className="fixed left-0 right-0 top-20 h-0.5 z-[60] pointer-events-none"
                aria-hidden
            >
                <div
                    className="h-full bg-landing-primary origin-left"
                    style={{ width: `${readingProgress}%`, transition: reduceMotion ? 'none' : 'width 80ms linear' }}
                />
            </div>

            <div className="sticky top-20 z-40 bg-landing-bg/90 backdrop-blur-xl border-b border-white/[0.06]">
                <div className="max-w-[42rem] mx-auto px-5 sm:px-6 h-12 flex items-center justify-between">
                    <Link
                        to="/blog"
                        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-[12px] font-semibold tracking-tight active:scale-[0.97]"
                    >
                        <ArrowLeft size={15} />
                        Blog
                    </Link>
                    <div className="flex items-center gap-0.5">
                        <AnimatePresence>
                            {copied && (
                                <motion.span
                                    initial={{ opacity: 0, x: 8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={spring}
                                    className="text-[11px] font-semibold text-landing-primary mr-2"
                                >
                                    Copied
                                </motion.span>
                            )}
                        </AnimatePresence>
                        <button
                            type="button"
                            onClick={handleShare}
                            className="w-9 h-9 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/5 active:scale-[0.97]"
                            aria-label="Copy link"
                        >
                            <Share2 size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setBookmarked(!bookmarked)}
                            className={`w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 active:scale-[0.97] ${bookmarked ? 'text-landing-primary' : 'text-white/50 hover:text-white'}`}
                            aria-label="Bookmark"
                        >
                            <Bookmark size={16} fill={bookmarked ? 'currentColor' : 'none'} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-[42rem] mx-auto px-5 sm:px-6 pt-10 md:pt-14">
                <header className="mb-10 text-left">
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-2 mb-5">
                        <span className="bg-landing-primary/15 text-landing-primary border border-landing-primary/25 text-[10px] font-semibold uppercase tracking-[0.16em] px-2.5 py-1 rounded-full">
                            {blog.category}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-white/60 text-[11px] font-semibold uppercase tracking-[0.12em]">
                            <Clock size={11} />{readTime}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-white/28 text-[11px] font-semibold uppercase tracking-[0.12em]">
                            <BookOpen size={11} />{wordCount.toLocaleString()} words
                        </span>
                    </div>

                    <h1 className="text-white">
                        {blog.title}
                    </h1>

                    <div className="flex items-center justify-between flex-wrap gap-4 mt-8 pt-6 border-t border-white/10">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                                {blog.author?.[0] || 'Y'}
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] text-white/38">Written by</p>
                                <p className="text-[15px] font-semibold text-white truncate">{blog.author || 'Yureka Editorial'}</p>
                            </div>
                        </div>
                        <div className="text-left sm:text-right">
                            <p className="text-[11px] text-white/38">Published</p>
                            <p className="text-[15px] font-semibold text-white">
                                {new Date(blog.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                </header>

                {blog.image ? (
                    <figure className="mb-10 -mx-5 sm:mx-0 sm:rounded-[1.25rem] overflow-hidden aspect-[16/9] border border-white/8">
                        <ImageWithLoader
                            src={blog.image}
                            alt={blog.title}
                            className="w-full h-full object-cover"
                        />
                    </figure>
                ) : null}

                <article>
                    {!blog.external_link && blog.excerpt && (
                        <p className="mb-8 text-[1.15rem] leading-relaxed text-white/70 border-l-[3px] border-landing-primary pl-4">
                            {blog.excerpt}
                        </p>
                    )}

                    {blog.external_link ? (
                        extractedHtml ? (
                            <div>
                                <div className="blog-article" dangerouslySetInnerHTML={{ __html: sanitizeHtml(extractedHtml) }} />
                                <p className="mt-10 pt-6 border-t border-white/8 text-center text-[11px] uppercase tracking-[0.16em] text-white/30">
                                    Original source: {new URL(blog.external_link).hostname}
                                </p>
                            </div>
                        ) : (
                            <div className="relative bg-white/5 rounded-[1.25rem] overflow-hidden border border-white/10 min-h-[50vh]">
                                {(isReaderLoading || isLoading) && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <Loader2 className="animate-spin text-landing-primary" size={36} />
                                    </div>
                                )}
                                <iframe
                                    src={blog.external_link}
                                    className="w-full min-h-[70vh] border-none"
                                    title={blog.title}
                                    allowFullScreen
                                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                                />
                            </div>
                        )
                    ) : (
                        isHtml ? (
                            <div className="blog-article" dangerouslySetInnerHTML={{ __html: sanitizeHtml(blog.content || '') }} />
                        ) : (
                            <div className="blog-article">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{blog.content}</ReactMarkdown>
                            </div>
                        )
                    )}
                </article>

                <div className="mt-12 p-6 sm:p-8 rounded-[1.35rem] bg-white/[0.04] border border-white/10 flex gap-4 items-start">
                    <div className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center text-lg font-bold shrink-0">
                        {blog.author?.[0] || 'Y'}
                    </div>
                    <div className="min-w-0 space-y-2">
                        <p className="text-[11px] text-white/50">About the author</p>
                        <p className="text-lg font-bold text-white">{blog.author || 'Yureka Editorial'}</p>
                        <p className="text-[14px] leading-relaxed text-white/70">
                            Senior analyst at Yureka, specializing in Indian credit ecosystems, reward optimization, and fintech strategy.
                        </p>
                        <Link to="/blog" className="inline-flex items-center gap-2 text-landing-primary text-[13px] font-semibold active:scale-[0.97] hover:underline">
                            More articles <ArrowLeft size={12} className="rotate-180" />
                        </Link>
                    </div>
                </div>

                {related.length > 0 && (
                    <div className="mt-16">
                        <div className="flex items-center gap-3 mb-6">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50 shrink-0">Related</p>
                            <div className="flex-1 h-px bg-white/10" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {related.map(post => (
                                <Link key={post.id} to={`/blog/${post.slug}`} className="group flex flex-col h-full active:scale-[0.99] transition-transform">
                                    <div className="aspect-[16/10] rounded-xl overflow-hidden mb-3 border border-white/8">
                                        <ImageWithLoader src={post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                                    </div>
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-landing-primary">{post.category}</span>
                                    <h4 className="text-[15px] font-bold text-white leading-snug mt-1 group-hover:text-landing-primary transition-colors line-clamp-2">{post.title}</h4>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mt-16 rounded-[1.35rem] bg-white/[0.03] border border-landing-primary/30 p-8 sm:p-10 text-center">
                    <p className="text-landing-primary text-[11px] font-semibold uppercase tracking-[0.18em] mb-3">Never miss a dispatch</p>
                    <h3 className="text-[1.65rem] font-extrabold text-white tracking-tight mb-3">
                        The future of credit is conversational.
                    </h3>
                    <p className="text-white/70 text-[15px] leading-relaxed mb-6">Join others on the AI-driven financial optimization platform.</p>
                    <Link
                        to="/join-waitlist"
                        className="inline-block bg-landing-primary text-landing-ink font-bold px-8 py-3.5 rounded-full uppercase tracking-[0.16em] text-[11px] active:scale-[0.97] hover:brightness-110 shadow-sm shadow-landing-primary/20 transition-all"
                    >
                        Join waitlist
                    </Link>
                </div>
            </div>

            <AnimatePresence>
                {showScrollTop && (
                    <motion.button
                        type="button"
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                        transition={spring}
                        onClick={() => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })}
                        className="fixed bottom-8 right-6 w-11 h-11 bg-white text-black rounded-full shadow-2xl flex items-center justify-center active:scale-[0.97] z-50"
                        aria-label="Back to top"
                    >
                        <ChevronUp size={18} />
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BlogDetail;
