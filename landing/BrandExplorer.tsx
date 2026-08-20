import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    Search, ChevronDown, ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SEO from '@shared/SEO';
import { SITE_URL, staticPageMeta } from '@backend/lib/seo/pageMeta';
import { breadcrumbSchema } from '@backend/lib/seo/structuredData';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    brands as allBrands,
    BRAND_CATEGORIES,
    Brand,
    brandCategoryFromSlug,
    brandsCategorySeo,
    categorySlug,
} from '@landing/brandsData';
import NotFoundPage from '@landing/NotFoundPage';
import Icon3d from '@shared/Icon3d';

const brands = allBrands.filter(b => b.image);

const CATEGORY_ICONS: Record<string, string> = {
    'All': 'cube',
    'Quick Commerce': 'flash',
    'New Brands': 'star',
    'Instore Brands': 'bag',
    'Jewellery': 'medal',
    'Food': 'cup',
    'Grocery': 'can',
    'E-Commerce': 'bag',
    'Hot Deals': 'fire',
    'Travel & Transport': 'travel',
    'Hotels': 'location',
    'Fashion': 'girl',
    'Beauty': 'paint-kit',
    'Gaming': 'computer',
    'Watches': 'clock',
    'Entertainment': 'camera',
    'Luxury': 'trophy',
    'Electronics': 'mobile',
    'Furnishing': 'cube',
    'Fitness': 'gym',
    'Accessories': 'glass',
    'Kids': 'boy',
    'Pharmacy': 'plus',
    'Footwear': 'gym',
    'OTT': 'play',
    'Hand Bags': 'bag',
};

const STATS = [
    { label: `${brands.length} Brand Partners`, icon: 'bag' },
    { label: `${BRAND_CATEGORIES.length - 1} Categories`, icon: 'cube' },
    { label: 'Up to 20% Cashback', icon: 'fire' },
];

const slugify = (value: string) => categorySlug(value);

const BrandCard: React.FC<{ brand: Brand; index: number }> = ({ brand, index }) => (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: '100px' }} transition={{ delay: (index % 4) * 0.05 }} className="group">
        <div className="relative bg-white/[0.03] backdrop-blur-xl rounded-[2.5rem] border border-white/10 p-2 h-full flex flex-col overflow-hidden hover:border-clay/30 hover:bg-white/[0.07] hover:-translate-y-1.5 transition-all duration-500 shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-clay/10">
            {/* glass sheen */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent pointer-events-none" />

            <div
                className={`relative aspect-video md:aspect-[1.6/1] rounded-[2rem] overflow-hidden mb-4 flex items-center justify-center ring-1 ring-white/5 ${brand.image && brand.bgColor ? '' : 'bg-white/[0.03]'}`}
                style={brand.image && brand.bgColor ? { backgroundColor: brand.bgColor } : undefined}
            >
                {!(brand.image && brand.bgColor) && (
                    <div className={`absolute w-28 h-28 rounded-full bg-gradient-to-br ${brand.color} opacity-10 blur-3xl group-hover:opacity-30 transition-opacity duration-700`} />
                )}
                {brand.image ? (
                    <img src={brand.image} alt={brand.name} loading="lazy" className="relative w-full h-full object-contain p-3 group-hover:scale-110 transition-transform duration-700" />
                ) : (
                    <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${brand.color} flex items-center justify-center text-white font-black text-2xl shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                        {brand.name.charAt(0)}
                    </div>
                )}
            </div>

            <h3 className="relative text-sm font-sans font-bold text-white text-center px-4 pb-6 uppercase tracking-wider group-hover:text-clay transition-colors">{brand.name}</h3>
        </div>
    </motion.div>
);

const BrandExplorer: React.FC = () => {
    const { category: categoryParam } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const categories = BRAND_CATEGORIES.slice(1);
    const activeCategory = brandCategoryFromSlug(categoryParam);

    useEffect(() => {
        const raw = location.hash.replace(/^#/, '');
        const match = raw.match(/^category-(.+)$/);
        if (!match) return;
        navigate(`/brands/${match[1].toLowerCase()}`, { replace: true });
    }, [location.hash, navigate]);

    useEffect(() => {
        if (!categoryParam) return;
        if (categoryParam !== categoryParam.toLowerCase()) {
            navigate(`/brands/${categoryParam.toLowerCase()}`, { replace: true });
        }
    }, [categoryParam, navigate]);

    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = { All: brands.length };
        categories.forEach(cat => {
            counts[cat] = brands.filter(b => b.categories.includes(cat)).length;
        });
        return counts;
    }, [categories]);

    const categorySections = useMemo(() => {
        const query = searchQuery.toLowerCase();
        const source = activeCategory ? [activeCategory] : categories;
        return source.map(cat => ({
            category: cat,
            brands: brands.filter(b => b.categories.includes(cat) && b.name.toLowerCase().includes(query)),
        }));
    }, [categories, searchQuery, activeCategory]);

    const totalMatches = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return brands.filter(b => b.name.toLowerCase().includes(query)).length;
    }, [searchQuery]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const handleScroll = () => setShowScrollTop(window.scrollY > 600);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleJumpTo = (category: string) => {
        setDropdownOpen(false);
        if (category === 'All') {
            navigate('/brands');
            return;
        }
        navigate(`/brands/${categorySlug(category)}`);
    };

    if (categoryParam && !activeCategory) {
        return <NotFoundPage />;
    }

    const indexMeta = staticPageMeta['/brands'];
    const catSeo = activeCategory ? brandsCategorySeo(activeCategory) : null;
    const canonical = activeCategory
        ? `${SITE_URL}/brands/${categorySlug(activeCategory)}`
        : `${SITE_URL}/brands`;
    const crumb = breadcrumbSchema(
        activeCategory
            ? [
                { name: 'Home', path: '/' },
                { name: 'Brands', path: '/brands' },
                { name: activeCategory, path: `/brands/${categorySlug(activeCategory)}` },
            ]
            : [
                { name: 'Home', path: '/' },
                { name: 'Brands', path: '/brands' },
            ],
    );

    return (
        <div className="min-h-screen bg-mesh pb-32 overflow-x-hidden text-white/90 selection:bg-clay selection:text-cream">
            <SEO
                title={catSeo?.title || indexMeta.title}
                description={catSeo?.description || indexMeta.description}
                keywords={catSeo?.keywords || indexMeta.keywords}
                canonical={canonical}
                schema={crumb}
            />

            {/* ── HERO ── */}
            <div className="relative pt-24 md:pt-40 pb-20 border-b border-white/5">
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 30c0-16.569-13.431-30-30-30v60c16.569 0 30-13.431 30-30zm0 0c0 16.569 13.431 30 30 30V0c-16.569 0-30 13.431-30 30z' fill='%23fff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")` }}
                />

                {/* ambient glow orbs */}
                <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-clay/[0.04] rounded-full blur-[160px] pointer-events-none" />
                <div className="absolute top-1/3 right-0 translate-x-1/2 w-[400px] h-[400px] bg-clay/[0.03] rounded-full blur-[140px] pointer-events-none" />

                <div className="max-w-[1400px] mx-auto px-6 relative z-10 text-center">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-clay mb-6">Reward Partners & Brands</p>
                        <h1 className="text-5xl sm:text-7xl md:text-8xl font-cirka font-medium text-white leading-[0.95] tracking-tighter mb-8">
                            {activeCategory ? (
                                <>
                                    {activeCategory}.<br /><span className="text-clay italic font-light">Earn more.</span>
                                </>
                            ) : (
                                <>
                                    Shop Smarter.<br /><span className="text-clay italic font-light">Earn More.</span>
                                </>
                            )}
                        </h1>
                        <p className="text-white/70 text-base md:text-xl font-serif italic max-w-2xl mx-auto leading-relaxed mb-10">
                            {activeCategory
                                ? `${categoryCounts[activeCategory] || 0} ${activeCategory.toLowerCase()} partners with cashback and Goldback.`
                                : `Explore ${brands.length} brand partners offering exclusive cashback, discounts, and rewards.`}
                        </p>

                        {/* ── STATS ── */}
                        <div className="flex flex-wrap items-center justify-center gap-3 mb-16">
                            {STATS.map(({ label, icon }) => (
                                <div key={label} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.04] backdrop-blur-xl border border-white/10 text-[10px] font-bold uppercase tracking-[0.2em] text-white/60 shadow-lg shadow-black/20">
                                    <Icon3d name={icon} className="h-5 w-5 object-contain" />
                                    {label}
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* ── SEARCH + JUMP TO CATEGORY ── */}
                    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="max-w-4xl mx-auto px-4">
                        <div className="bg-white/[0.04] backdrop-blur-3xl rounded-[2.5rem] border border-white/10 ring-1 ring-white/5 p-3 shadow-2xl shadow-black/40 flex flex-col sm:flex-row items-center gap-3">
                            <div className="relative w-full group flex-1">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-clay transition-colors" size={18} />
                                <input type="text" placeholder="Search brands..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-14 pr-6 py-4 bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl outline-none focus:border-clay/50 focus:bg-white/[0.06] transition-all text-sm text-white"
                                />
                            </div>

                            <div className="relative w-full sm:w-auto shrink-0" ref={dropdownRef}>
                                <button onClick={() => setDropdownOpen(o => !o)}
                                    className="w-full sm:w-auto flex items-center justify-between gap-3 px-6 py-4 bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white/70 hover:text-white hover:border-clay/40 hover:bg-white/[0.06] transition-all sm:min-w-[220px]"
                                >
                                    <span className="flex items-center gap-2">
                                        <Icon3d name={activeCategory ? (CATEGORY_ICONS[activeCategory] || 'cube') : 'cube'} className="h-5 w-5 object-contain" />
                                        {activeCategory || 'Jump To Category'}
                                    </span>
                                    <ChevronDown size={14} className={`text-white/40 transition-transform duration-300 ${dropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {dropdownOpen && (
                                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                                        className="absolute right-0 left-0 sm:left-auto mt-2 w-full sm:w-72 max-h-96 overflow-y-auto bg-[#0a0a0a]/80 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5 rounded-2xl shadow-2xl shadow-black/50 z-50 p-2 text-left"
                                    >
                                        <button onClick={() => handleJumpTo('All')}
                                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-[10px] font-black uppercase tracking-[0.2em] text-white/70 hover:bg-white/5 hover:text-clay transition-colors"
                                        >
                                            <Icon3d name="cube" className="h-6 w-6 object-contain" />
                                            All Brands
                                            <span className="ml-auto text-[9px] font-bold text-white/30">{categoryCounts.All}</span>
                                        </button>
                                        {categories.map(cat => {
                                            const icon = CATEGORY_ICONS[cat] || 'cube';
                                            return (
                                                <button key={cat} onClick={() => handleJumpTo(cat)}
                                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-[10px] font-black uppercase tracking-[0.2em] text-white/70 hover:bg-white/5 hover:text-clay transition-colors"
                                                >
                                                    <Icon3d name={icon} className="h-6 w-6 object-contain" />
                                                    {cat}
                                                    <span className="ml-auto text-[9px] font-bold text-white/30">{categoryCounts[cat]}</span>
                                                </button>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* ── CATEGORY SECTIONS ── */}
            <div className="max-w-[1400px] mx-auto px-6 py-12">
                {categorySections.map(({ category, brands: sectionBrands }) => {
                    if (sectionBrands.length === 0) return null;
                    const icon = CATEGORY_ICONS[category] || 'cube';
                    return (
                        <section key={category} id={`category-${slugify(category)}`} className="scroll-mt-28 mb-20">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10 shrink-0 shadow-lg shadow-black/20">
                                    <Icon3d name={icon} className="h-10 w-10 object-contain" />
                                </div>
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-cirka font-medium text-white tracking-tight">{category}</h2>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mt-1">
                                        {sectionBrands.length} {sectionBrands.length === 1 ? 'Brand' : 'Brands'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {sectionBrands.map((brand, index) => (
                                    <BrandCard key={brand.id} brand={brand} index={index} />
                                ))}
                            </div>
                        </section>
                    );
                })}

                {searchQuery !== '' && totalMatches === 0 && (
                    <div className="flex justify-center py-32">
                        <div className="inline-flex flex-col items-center gap-4 px-12 py-16 rounded-[2.5rem] bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/30">
                            <Icon3d name="zoom" className="h-12 w-12 object-contain opacity-70" />
                            <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/40 italic">No brands found matching "{searchQuery}"</p>
                            <button onClick={() => setSearchQuery('')}
                                className="mt-2 text-clay text-[11px] font-bold uppercase tracking-widest hover:underline">Clear Search</button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── SCROLL TO TOP ── */}
            <AnimatePresence>
                {showScrollTop && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="fixed bottom-32 right-7 w-12 h-12 bg-white/10 backdrop-blur-xl text-white rounded-full shadow-2xl shadow-black/40 flex items-center justify-center hover:bg-clay hover:text-black hover:border-clay/40 transition-all z-50 border border-white/20"
                    >
                        <ChevronUp size={20} />
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BrandExplorer;
