import React, { useState } from 'react';
import { ArrowRight, Clock, Search, X, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import ImageWithLoader from '@shared/ImageWithLoader';
import { useSupabase } from '@shared/SupabaseProvider';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import SEO from '@shared/SEO';
import { staticPageMeta } from '@backend/lib/seo/pageMeta';

const CATEGORIES = ['All', 'Credit Cards', 'Rewards', 'Travel', 'AI', 'Strategy', 'History', 'Finance'];

const spring = { type: 'spring' as const, bounce: 0, duration: 0.4 };

const JournalPage: React.FC = () => {
    const { blogs: blogsList, isLoading } = useSupabase();
    const reduceMotion = useReducedMotion();
    const [activeCategory, setActiveCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);

    const filtered = blogsList.filter(b => {
        const matchCat = activeCategory === 'All' || b.category === activeCategory;
        const matchSearch = !searchQuery || b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.excerpt?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
    });

    const hero = filtered[0];
    const featured = filtered.slice(1, 4);
    const rest = filtered.slice(4);
    const fade = reduceMotion
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
        : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: spring };

    if (isLoading && blogsList.length === 0) {
        return (
            <div className="blog-reading min-h-screen bg-cream px-5 sm:px-8 pt-6 md:pt-10">
                <div className="max-w-6xl mx-auto space-y-10">
                    <div className="h-10 w-48 bg-white/5 rounded-2xl animate-pulse" />
                    <div className="h-[42vh] min-h-[240px] bg-white/5 rounded-[1.75rem] animate-pulse" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => <div key={i} className="h-64 bg-white/5 rounded-2xl animate-pulse" />)}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="blog-reading min-h-screen bg-cream pb-28 text-white selection:bg-clay selection:text-cream">
            <SEO {...staticPageMeta['/blog']} />

            <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-6 md:pt-10">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 pb-10 border-b border-white/10 mb-10">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-clay mb-3">Yureka Editorial</p>
                        <h1 className="text-[clamp(2.4rem,6vw,4.5rem)] font-extrabold text-white leading-[1.05] tracking-[-0.03em]">
                            Blog
                        </h1>
                        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/50">
                            Credit, gold, and spending — written for people who actually shop.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <AnimatePresence>
                            {searchOpen ? (
                                <motion.div
                                    initial={{ width: 0, opacity: 0 }}
                                    animate={{ width: 260, opacity: 1 }}
                                    exit={{ width: 0, opacity: 0 }}
                                    transition={reduceMotion ? { duration: 0.2 } : spring}
                                    className="relative overflow-hidden"
                                >
                                    <input
                                        autoFocus
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Search articles..."
                                        className="w-full bg-white/5 border border-white/10 rounded-full px-5 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-clay/50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white active:scale-[0.97]"
                                        aria-label="Close search"
                                    >
                                        <X size={16} />
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.button
                                    type="button"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    onClick={() => setSearchOpen(true)}
                                    className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 active:scale-[0.97] transition-colors"
                                    aria-label="Search articles"
                                >
                                    <Search size={16} />
                                </motion.button>
                            )}
                        </AnimatePresence>
                        <div className="text-right min-w-[4.5rem]">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-white/40 font-semibold">{blogsList.length} articles</p>
                        </div>
                    </div>
                </div>

                <div className="relative mb-12 -mx-5 sm:mx-0">
                    <div className="flex gap-2 overflow-x-auto px-5 sm:px-0 sm:flex-wrap pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setActiveCategory(cat)}
                                className={`shrink-0 px-4 py-2 rounded-full text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors active:scale-[0.97] ${
                                    activeCategory === cat
                                        ? 'bg-clay text-black'
                                        : 'bg-white/5 text-white/45 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-cream to-transparent sm:hidden" />
                </div>

                {hero && (
                    <motion.div {...fade} className="mb-14">
                        <Link
                            to={`/blog/${hero.slug}`}
                            className="group grid grid-cols-1 lg:grid-cols-12 overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03] active:scale-[0.995] transition-transform"
                        >
                            <div className="lg:col-span-7 aspect-[16/10] lg:aspect-auto lg:min-h-[360px] overflow-hidden">
                                <ImageWithLoader
                                    src={hero.image}
                                    alt={hero.title}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                                />
                            </div>
                            <div className="lg:col-span-5 flex flex-col justify-center p-6 sm:p-8 lg:p-10">
                                <div className="flex flex-wrap items-center gap-3 mb-4">
                                    <span className="bg-clay/15 text-clay text-[10px] font-semibold uppercase tracking-[0.16em] px-3 py-1 rounded-full">{hero.category}</span>
                                    <span className="text-white/40 text-[11px] font-semibold uppercase tracking-[0.14em] inline-flex items-center gap-1.5">
                                        <Clock size={11} />{hero.read_time || '5 min read'}
                                    </span>
                                </div>
                                <h2 className="text-[1.65rem] sm:text-[2rem] font-extrabold text-white leading-[1.15] tracking-[-0.03em] group-hover:text-clay transition-colors">
                                    {hero.title}
                                </h2>
                                {hero.excerpt ? (
                                    <p className="mt-3 text-[15px] leading-relaxed text-white/50 line-clamp-3">{hero.excerpt}</p>
                                ) : null}
                                <div className="mt-6 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-clay/20 text-clay text-xs font-bold flex items-center justify-center shrink-0">
                                            {hero.author?.[0] || 'Y'}
                                        </div>
                                        <span className="text-[12px] text-white/45 truncate">{hero.author || 'Yureka Editorial'}</span>
                                    </div>
                                    <span className="inline-flex items-center gap-1.5 text-[12px] text-white/40 group-hover:text-clay transition-colors shrink-0">
                                        Read <ArrowRight size={14} />
                                    </span>
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                )}

                {featured.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
                        {featured.map((post, i) => (
                            <motion.div
                                key={post.id}
                                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={reduceMotion ? { duration: 0.2 } : { ...spring, delay: i * 0.05 }}
                                className="h-full"
                            >
                                <Link to={`/blog/${post.slug}`} className="group h-full flex flex-col rounded-[1.4rem] border border-white/10 bg-white/[0.03] overflow-hidden active:scale-[0.99] transition-transform">
                                    <div className="relative aspect-[16/10] overflow-hidden">
                                        <ImageWithLoader src={post.image} alt={post.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                                        <span className="absolute top-3 left-3 bg-black/55 backdrop-blur-md text-white text-[9px] font-semibold uppercase tracking-[0.16em] px-2.5 py-1 rounded-full">
                                            {post.category}
                                        </span>
                                    </div>
                                    <div className="flex flex-col flex-1 p-5 space-y-2.5">
                                        <h3 className="text-[17px] font-bold text-white leading-snug tracking-[-0.02em] group-hover:text-clay transition-colors line-clamp-2">{post.title}</h3>
                                        <p className="text-[13px] text-white/40 leading-relaxed line-clamp-2 flex-1">{post.excerpt}</p>
                                        <div className="flex items-center gap-2 pt-1 text-[11px] text-white/35">
                                            <span className="truncate">{post.author || 'Yureka'}</span>
                                            <span className="text-white/15">·</span>
                                            <span className="inline-flex items-center gap-1 shrink-0"><Clock size={10} />{post.read_time || '5m'}</span>
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                )}

                {rest.length > 0 && (
                    <div className="flex items-center gap-3 mb-8 pt-2 border-t border-white/10">
                        <TrendingUp size={14} className="text-clay shrink-0" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">More articles</span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-10">
                    {rest.map((post, idx) => (
                        <motion.div
                            key={post.id}
                            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={reduceMotion ? { duration: 0.2 } : { ...spring, delay: (idx % 3) * 0.04 }}
                            className="h-full"
                        >
                            <Link to={`/blog/${post.slug}`} className="group h-full flex flex-col active:scale-[0.99] transition-transform">
                                <div className="relative aspect-[16/10] rounded-[1.15rem] overflow-hidden mb-4 border border-white/10">
                                    <ImageWithLoader src={post.image} alt={post.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                                    <span className="absolute bottom-3 left-3 bg-clay text-black text-[9px] font-semibold uppercase tracking-[0.14em] px-2 py-1 rounded-full">
                                        {post.category}
                                    </span>
                                </div>
                                <h3 className="text-[16px] font-bold text-white leading-snug tracking-[-0.02em] group-hover:text-clay transition-colors line-clamp-2">{post.title}</h3>
                                <p className="mt-2 text-[13px] text-white/40 leading-relaxed line-clamp-2 flex-1">{post.excerpt}</p>
                                <div className="mt-3 flex items-center justify-between text-[11px] text-white/30">
                                    <span className="truncate">{post.author || 'Yureka'}</span>
                                    <span className="inline-flex items-center gap-1 shrink-0"><Clock size={10} />{post.read_time || '5m'}</span>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>

                {filtered.length === 0 && (
                    <div className="py-28 text-center">
                        <p className="text-[13px] text-white/40">No articles match that filter.</p>
                        <button
                            type="button"
                            onClick={() => { setActiveCategory('All'); setSearchQuery(''); }}
                            className="mt-5 text-clay text-[12px] font-semibold uppercase tracking-[0.16em] active:scale-[0.97]"
                        >
                            Clear filters
                        </button>
                    </div>
                )}

                <motion.section
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="mt-24 rounded-[1.75rem] bg-gradient-to-br from-clay to-[#00933b] p-10 md:p-16 text-center overflow-hidden relative"
                >
                    <div className="relative max-w-xl mx-auto space-y-5">
                        <p className="text-black/55 text-[11px] font-semibold uppercase tracking-[0.2em]">Weekly dispatch</p>
                        <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-extrabold text-black leading-[1.12] tracking-[-0.03em]">
                            Stay ahead of the credit curve
                        </h2>
                        <p className="text-black/65 text-[15px] leading-relaxed">
                            Deep analysis of credit markets and reward loops, every Sunday.
                        </p>
                        <form className="flex flex-col sm:flex-row gap-2.5 max-w-md mx-auto" onSubmit={(e) => e.preventDefault()}>
                            <input
                                type="email"
                                placeholder="your@email.com"
                                className="flex-1 bg-black/10 border border-black/10 rounded-xl px-4 py-3.5 text-black placeholder:text-black/40 outline-none focus:border-black/30 text-sm"
                            />
                            <button type="submit" className="bg-black text-white px-6 py-3.5 rounded-xl text-[11px] font-semibold uppercase tracking-[0.16em] active:scale-[0.97] shrink-0">
                                Subscribe
                            </button>
                        </form>
                    </div>
                </motion.section>
            </div>
        </div>
    );
};

export default JournalPage;
