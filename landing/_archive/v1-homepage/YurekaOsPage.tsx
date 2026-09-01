import React from 'react';
import { Gift, Zap, ShieldCheck, ArrowRight, Star, Percent, Utensils, ShoppingBag, Loader2 } from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '@backend/lib/api/client';
import SEO from '@shared/SEO';
import { staticPageMeta } from '@backend/lib/seo/pageMeta';

const YurekaOsPage: React.FC = () => {
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard');
  const basePath = isDashboard ? '/dashboard' : '';

  React.useEffect(() => {
    if (isDashboard) {
      navigate(`${basePath}/rewards-calculator`, { replace: true });
    }
  }, [isDashboard, navigate, basePath]);

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      await api.post('/api/v1/waitlist/join', { email, source_channel: 'yureka-os-hero' }, { skipAuth: true });
      localStorage.setItem('yureka_points_access', email);
      navigate(`${basePath}/rewards-calculator`);
    } catch (err) {
      console.error('Calculation flow error:', err);
      localStorage.setItem('yureka_points_access', email); 
      navigate(`${basePath}/rewards-calculator`); 
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-cream overflow-x-hidden selection:bg-clay selection:text-cream">
      <SEO {...staticPageMeta['/free-tools']} />
      {/* Immersive Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-clay/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[50%] bg-[#00933b]/5 rounded-full blur-[100px]" />
        <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-[#00933b]/5 rounded-full blur-[80px]" />
        <div 
          className="absolute inset-0 opacity-[0.03] mix-blend-screen pointer-events-none" 
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
        />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 pt-8 md:pt-12 pb-32">

        {/* Hyper-Premium Hero Section */}
        <section id="rewards-calculator" className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center mb-40 scroll-mt-32">

          
          {/* Visual Canvas */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative order-2 lg:order-1"
          >
            <div className="relative h-[450px] md:h-[650px] rounded-[3rem] overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] group border border-white/5">
              <img 
                src="/assets/hero/eiffel-points.png" 
                alt="Eiffel Tower representing global travel rewards" 
                className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110 opacity-70"
              />
              
              {/* Dynamic Glass Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-cream via-cream/20 to-transparent flex flex-col justify-end p-8 md:p-16">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-6"
                >
                  <div className="flex -space-x-3 items-center mb-4">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="w-10 h-10 rounded-full border-2 border-white/10 bg-white/5 overflow-hidden shadow-lg backdrop-blur-sm">
                        <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt={`Community Member ${i+1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                    <div className="h-10 px-4 rounded-full border border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-center text-[10px] font-bold text-white uppercase tracking-widest ml-4">
                      +5,400 members
                    </div>
                  </div>
                  
                  <h2 className="text-5xl md:text-8xl font-sans font-extrabold text-white leading-[0.85] tracking-tighter">
                    Your Card <br /> <span className="text-white/20 italic font-light">can unlock</span> <br /> wonders
                  </h2>
                  <div className="h-px w-full bg-white/10" />
                  <p className="text-white/40 text-[10px] tracking-widest uppercase font-bold flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-clay animate-pulse shadow-[0_0_8px_#00933b]" />
                    Real-time valuations across 10+ partners
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Floating Decorative Elements */}
            <div className="absolute top-10 -right-8 w-16 h-16 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl flex items-center justify-center rotate-12 transition-transform hover:rotate-0 cursor-default hidden md:flex">
              <Percent size={24} className="text-clay" />
            </div>
            <div className="absolute bottom-20 -left-10 w-20 h-20 bg-clay text-cream rounded-[2rem] shadow-2xl flex items-center justify-center -rotate-6 transition-transform hover:rotate-0 cursor-default hidden md:flex">
              <Zap size={30} fill="currentColor" />
            </div>
          </motion.div>

          {/* Value Proposition & Form */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col justify-center order-1 lg:order-2 text-center lg:text-left items-center lg:items-start"
          >
            <div className="space-y-8 w-full max-w-md lg:max-w-none flex flex-col items-center lg:items-start">
              <div className="inline-flex flex-col sm:flex-row items-center lg:items-start gap-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-clay/10 rounded-full border border-clay/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-clay animate-ping" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-clay">Limited Beta Access Live</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 mt-2 sm:mt-0">Project // FREE TOOLS</div>
              </div>
              
              <div className="space-y-4">
                <h1 className="text-5xl md:text-7xl font-sans font-extrabold tracking-tighter text-white leading-[0.9] lg:max-w-md mx-auto lg:mx-0">
                   Optimize your <br /> <span className="text-white/20 italic font-light">Reward</span> <br /> transfers.
                </h1>
                <p className="text-white/50 font-sans text-xl font-medium max-w-sm leading-relaxed mx-auto lg:mx-0">
                   Stop guessing. Our Free Tools audit the exact mathematical yield for your specific redemption goals.
                </p>
              </div>

              <form onSubmit={handleCalculate} className="space-y-6 pt-4 w-full">
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto lg:mx-0">
                  <div className="flex-1 relative group">
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="aditya@example.com" 
                      required
                      className="w-full px-6 py-5 rounded-2xl border border-white/10 focus:ring-4 focus:ring-clay/10 focus:border-clay/30 outline-none transition-all text-lg font-sans bg-[#111111] text-white shadow-inner placeholder:text-white/10 text-center sm:text-left"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="relative overflow-hidden bg-clay text-cream px-10 py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-white active:scale-95 transition-all group shadow-2xl shadow-clay/10 shrink-0 w-full sm:w-auto"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    {loading ? <Loader2 size={20} className="animate-spin" /> : (
                      <>
                        <span className="text-sm uppercase tracking-widest">Get access for Free</span>
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>



                <div className="text-center lg:text-left">
                  <p className="text-[10px] text-white/30 font-sans tracking-wide">
                    By continuing, you agree to our <Link to={`${basePath}/terms`} className="text-white underline">Terms of Service</Link>
                  </p>
                </div>
              </form>
            </div>
          </motion.div>
        </section>

        {/* Feature Experience Grid */}
        <section className="mb-40">
           <div className="text-center mb-20">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-clay mb-4">Precision Engineering</h2>
              <h3 className="text-4xl md:text-6xl font-sans font-extrabold tracking-tight text-white leading-tight">Built for rewards maximizers.</h3>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {[
               { icon: Zap, title: "Yield Engine", desc: "Instantly compare 3,600+ transfer paths to find the absolute highest value per point.", color: "bg-clay text-clay", profit: "+ ₹24,000/yr" },
               { icon: Star, title: "Elite Vouchers", desc: "Stack savings with 500+ premium brands. Buy vouchers at bulk rates directly on your dashboard.", color: "bg-clay text-clay", profit: "8.5% Extra Saving" },
               { icon: ShieldCheck, title: "Zero Commission", desc: "Our advice is purely mathematical. We don't accept kickbacks, ensuring your data remains unbiased.", color: "bg-white text-white", profit: "100% Transparent" }
             ].map((feature, i) => (
               <motion.div 
                 key={feature.title} 
                 initial={{ opacity: 0, y: 20 }}
                 whileInView={{ opacity: 1, y: 0 }}
                 viewport={{ once: true }}
                 transition={{ delay: i * 0.1 }}
                 className="group relative p-10 bg-white/[0.03] rounded-[2.5rem] border border-white/5 hover:border-clay/30 transition-all hover:shadow-[0_30px_60px_-12px_rgba(0,147,59,0.1)] backdrop-blur-md"
               >
                 <div className={`w-14 h-14 ${feature.color.split(' ')[0]}/10 rounded-2xl flex items-center justify-center ${feature.color.split(' ')[1]} mb-8 group-hover:scale-110 transition-transform duration-500`}>
                   <feature.icon size={28} />
                 </div>
                 <h4 className="text-2xl font-sans font-extrabold text-white mb-4 flex items-center gap-3">
                    {feature.title}
                 </h4>
                 <p className="text-white/40 leading-relaxed mb-6 font-medium sm:h-20">
                    {feature.desc}
                 </p>
                 <div className="flex items-center justify-between border-t border-white/5 pt-6">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Status: Verified</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${feature.color.split(' ')[1]}`}>{feature.profit}</span>
                 </div>
               </motion.div>
             ))}
           </div>
        </section>

        {/* Global Access CTA */}
        <motion.section 
          whileHover={{ scale: 1.01 }}
          className="bg-white/[0.03] border border-white/10 rounded-[4rem] p-10 md:p-24 text-center text-white relative overflow-hidden shadow-2xl backdrop-blur-xl"
        >
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-clay/10 rounded-full blur-[100px]" />
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-clay/5 rounded-full blur-[100px]" />
          
          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-7xl font-sans font-extrabold mb-8 leading-[0.9] tracking-tighter">
              Ready to win the <br /> <span className="text-clay italic font-light">points game?</span>
            </h2>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link to={`${basePath}/join-waitlist`} className="bg-clay text-cream px-10 py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all hover:bg-white flex items-center justify-center gap-3 group">
                Reserve your spot <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to={`${basePath}/cards`} className="border border-white/10 hover:border-clay/30 text-white px-10 py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center backdrop-blur-sm">
                Review Top Card Combinations
              </Link>
            </div>
            
            <p className="mt-12 text-white/20 text-[10px] font-bold uppercase tracking-[0.5em]">
               Joined by travelers from 43 countries
            </p>
          </div>
        </motion.section>

      </div>
    </div>
  );
};

export default YurekaOsPage;
