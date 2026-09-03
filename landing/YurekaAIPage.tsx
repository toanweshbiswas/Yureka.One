import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Brain, CreditCard, ShoppingBag, Gift, TrendingUp,
  ArrowRight, ChevronRight, Zap, Star, Shield, BarChart3,
  MessageCircle, User, Bot, Send, Check, Percent,
  RefreshCw, Target, Wallet, Globe
} from 'lucide-react';

// Simulated chat messages that auto-play
const DEMO_CHAT: { role: 'user' | 'ai'; text: string; delay: number }[] = [
  { role: 'user', text: 'Which card should I use for my Swiggy order?', delay: 0 },
  { role: 'ai', text: 'Based on your spending profile, route this Swiggy order through Yureka. you earn Goldback on the spend and keep the best merchant deal. That beats a typical cashback wallet by ~₹18 on this ₹600 order.', delay: 900 },
  { role: 'user', text: "I have 42,000 reward points on Axis Magnus, best use?", delay: 2000 },
  { role: 'ai', text: 'Your 42,000 Axis Edge Reward Points are worth ₹10,500 at 25p/point for cash. but if you transfer to Singapore Airlines KrisFlyer (1:1 ratio), they\'re worth ₹18,900 in business class redemptions. I\'d transfer.', delay: 1200 },
  { role: 'user', text: 'Can you save me more on my Amazon shopping?', delay: 1800 },
  { role: 'ai', text: 'Yes! Buy a ₹2,000 Amazon gift card via **RewardX** for ₹1,820 (9% off), then pay with your ICICI Amazon card for 5% cashback. Total effective discount: **14%** on this order.', delay: 1000 },
];

// On-brand two-tone system: neon-lime (landing-primary) as primary, gold as the accent . 
const CLAY_TONE = { bg: 'bg-landing-primary/10', text: 'text-landing-primary', glow: 'shadow-landing-primary/20', border: 'border-landing-primary/25' };
const GOLD_TONE = { bg: 'bg-[#E8C468]/10', text: 'text-[#E8C468]', glow: 'shadow-[#E8C468]/20', border: 'border-[#E8C468]/20' };
const COLOR_MAP: Record<string, { bg: string; text: string; glow: string; border: string }> = {
  clay: CLAY_TONE,
  teal: CLAY_TONE,
  blue: CLAY_TONE,
  emerald: CLAY_TONE,
  purple: GOLD_TONE,
  rose: GOLD_TONE,
};

const CAPABILITIES = [
  {
    icon: CreditCard,
    title: 'Smart Card Picker',
    desc: 'Tell Yureka AI your lifestyle and it builds a mathematically optimal rewards plan. no bias, pure yield.',
    stat: '₹24,000/yr avg gain',
    color: 'clay',
  },
  {
    icon: Zap,
    title: 'Real-time Spend Coach',
    desc: 'Before every transaction, know exactly which card to swipe and why. Maximise rewards on every ₹ you spend.',
    stat: '3.8% avg reward rate',
    color: 'teal',
  },
  {
    icon: Gift,
    title: 'Reward Yield Engine',
    desc: 'Tracks 3,600+ transfer paths across miles, hotel points, and cashback to ensure your points never expire in vain.',
    stat: '60%+ more point value',
    color: 'purple',
  },
  {
    icon: ShoppingBag,
    title: 'RewardX Shopping',
    desc: 'Stack gift card discounts with card rewards and Yureka AI cashback. Get 8-15% off across 500+ top Indian brands.',
    stat: '8 to 15% extra discount',
    color: 'emerald',
  },
  {
    icon: BarChart3,
    title: 'Portfolio Intelligence',
    desc: 'AI monitors your entire card portfolio. fee waiver thresholds, milestone benefits, and renewal worth analysis.',
    stat: 'Auto fee-waiver alerts',
    color: 'blue',
  },
  {
    icon: Target,
    title: 'Goal-Based Planning',
    desc: 'Planning a Maldives trip? Business class upgrade? Set a goal and the AI maps a personalised point accumulation strategy.',
    stat: 'Goal achieved 2× faster',
    color: 'rose',
  }
];

const STATS = [
  { label: 'Cards Analysed', value: '200+', icon: CreditCard },
  { label: 'Reward Paths', value: '3,600+', icon: TrendingUp },
  { label: 'Avg Annual Saving', value: '₹24K', icon: Wallet },
  { label: 'Partner Brands', value: '500+', icon: Globe },
];

// Animated typing indicator
const TypingIndicator = () => (
  <div className="flex gap-1 px-4 py-3">
    {[0, 1, 2].map(i => (
      <motion.div
        key={i}
        className="w-2 h-2 rounded-full bg-landing-primary"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
      />
    ))}
  </div>
);

// Render bold markdown in AI text
const renderText = (text: string) => {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1 ? <strong key={i} className="font-black text-landing-primary">{p}</strong> : p
  );
};

const LiveChatDemo = () => {
  const [visibleMessages, setVisibleMessages] = useState<typeof DEMO_CHAT>([]);
  const [showTyping, setShowTyping] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (msgIndex >= DEMO_CHAT.length) return;
    const msg = DEMO_CHAT[msgIndex];
    const timer = setTimeout(() => {
      if (msg.role === 'ai') {
        setShowTyping(true);
        setTimeout(() => {
          setShowTyping(false);
          setVisibleMessages(prev => [...prev, msg]);
          setMsgIndex(i => i + 1);
        }, 1400);
      } else {
        setVisibleMessages(prev => [...prev, msg]);
        setMsgIndex(i => i + 1);
      }
    }, msg.delay + (msgIndex === 0 ? 800 : 400));
    return () => clearTimeout(timer);
  }, [msgIndex]);



  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [visibleMessages, showTyping]);

  return (
    <div className="relative bg-[#000000]/90 rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl shadow-black/50">
      {/* Chrome Bar */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5 bg-white/[0.02]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/40" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/40" />
          <div className="w-3 h-3 rounded-full bg-landing-primary/40" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-2 px-4 py-1 bg-white/5 rounded-full border border-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-landing-primary animate-pulse" />
            <span className="text-[10px] text-white/50 font-mono tracking-widest uppercase">Yureka AI · Live Session</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-landing-primary" />
          <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">v2 · Pro</span>
        </div>
      </div>

      {/* Chat Area */}
      <div ref={scrollRef} className="h-[320px] sm:h-[380px] overflow-y-auto px-6 py-6 space-y-4 no-scrollbar">
        {/* Welcome state */}
        {visibleMessages.length === 0 && !showTyping && (
          <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40">
            <Brain size={40} className="text-landing-primary" />
            <p className="text-white/40 text-sm font-sans text-center">Your AI co-pilot is ready</p>
          </div>
        )}

        <AnimatePresence>
          {visibleMessages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className={`flex items-end gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${msg.role === 'ai' ? 'bg-landing-primary/10' : 'bg-white/5'}`}>
                {msg.role === 'ai' ? <Bot size={16} className="text-landing-primary" /> : <User size={16} className="text-white/30" />}
              </div>
              <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed font-sans ${
                msg.role === 'ai'
                  ? 'bg-white/5 border border-white/10 text-white rounded-bl-sm'
                  : 'bg-landing-primary text-landing-ink rounded-br-sm shadow-lg shadow-landing-primary/20 font-bold'
              }`}>
                {msg.role === 'ai' ? renderText(msg.text) : msg.text}
              </div>
            </motion.div>
          ))}

          {showTyping && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-end gap-3"
            >
              <div className="w-8 h-8 shrink-0 rounded-full bg-landing-primary/10 flex items-center justify-center">
                <Bot size={16} className="text-landing-primary" />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm">
                <TypingIndicator />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-t border-white/5 bg-white/[0.02]">
        <div className="flex-1 flex items-center gap-3 px-4 py-2.5 bg-black rounded-xl border border-white/5">
          <MessageCircle size={16} className="text-white/20 shrink-0" />
          <span className="text-white/30 text-sm font-sans">Ask anything about rewards…</span>
        </div>
        <button className="w-10 h-10 bg-landing-primary rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-landing-primary/20 hover:brightness-110 transition-all">
          <Send size={16} className="text-landing-ink" />
        </button>
      </div>
    </div>
  );
};

const YurekaAIPage: React.FC = () => {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard');
  const basePath = isDashboard ? '/dashboard' : '';

  return (
    <div className="yureka-ai-page relative min-h-screen bg-landing-bg overflow-x-hidden text-white selection:bg-landing-primary selection:text-landing-ink">
      {/* Background Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-landing-primary/5 rounded-full blur-[140px]" />
        <div className="absolute top-[30%] right-[-10%] w-[35%] h-[40%] bg-landing-primary/5 rounded-full blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 0.5px, transparent 0)', backgroundSize: '48px 48px' }}
        />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 pt-12 pb-40">

        {/* HERO */}
        <section id="ai-hero" className="text-center mb-28 scroll-mt-32">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 bg-landing-primary/10 border border-landing-primary/25 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-landing-primary animate-ping" />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-landing-primary">Yureka AI · Personalised Intelligence</span>
            </div>

            <h1 className="text-3xl sm:text-6xl md:text-7xl font-sans font-black tracking-tight text-white leading-[1.05] mb-8 max-w-5xl mx-auto">
              Your financial life,{' '}
              <span className="font-cooper text-landing-primary">optimised</span>{' '}
              by AI.
            </h1>

            <p className="text-white text-xl md:text-2xl font-sans max-w-3xl mx-auto leading-relaxed mb-12">
              From deciding how to spend to squeezing every rupee of reward. Yureka AI is your always-on financial co-pilot.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                to={`${basePath}/join-waitlist`}
                className="group relative overflow-hidden bg-landing-primary text-landing-ink font-bold px-10 py-5 rounded-2xl uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-2xl shadow-landing-primary/20 hover:brightness-110 transition-all"
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <Sparkles size={16} />
                Get Early Access
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#ai-demo"
                className="px-10 py-5 rounded-2xl font-bold uppercase tracking-widest text-xs border border-white/10 text-white hover:border-landing-primary/40 transition-all flex items-center justify-center gap-2 backdrop-blur-sm"
              >
                See It In Action
              </a>
            </div>
          </motion.div>

          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-20 max-w-3xl mx-auto"
          >
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col items-center p-6 bg-white/[0.03] border border-white/5 rounded-2xl shadow-2xl backdrop-blur-md">
                <s.icon size={20} className="text-clay mb-3 opacity-70" />
                <div className="text-2xl font-sans font-extrabold text-white tracking-tight mb-1">{s.value}</div>
                <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest text-center">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </section>

        {/* LIVE DEMO */}
        <section id="ai-demo" className="mb-40 scroll-mt-32">

          <div className="text-center mb-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-clay mb-4">See it in action</p>
            <h2 className="text-3xl sm:text-6xl font-sans font-extrabold text-white tracking-tighter leading-tight">
              Ask anything. <br className="sm:hidden" /> <span className="text-white/20 italic font-light">Get precision.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <LiveChatDemo />
            </div>

            <div className="space-y-6">
              {[
                { q: 'Which card should I use right now?', a: 'Instant per-transaction recommendation based on merchant, category, and your card portfolio.', icon: CreditCard },
                { q: 'How to maximise my 80,000 points?', a: 'Multi-path analysis across 3,600+ transfer options to find the highest real-world value.', icon: TrendingUp },
                { q: 'Find me the best shopping deal today', a: 'Stacks gift card discounts + card rewards + RewardX savings for maximum checkout value.', icon: ShoppingBag },
                { q: 'Is my card renewal worth it?', a: 'Calculates your actual earned value vs annual fee. Tells you exactly when to upgrade or quit.', icon: BarChart3 },
              ].map((item, i) => (
                <motion.div
                  key={item.q}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-4 p-5 bg-white/[0.03] border border-white/5 rounded-2xl hover:bg-white/[0.06] hover:border-clay/20 transition-all group cursor-default shadow-sm backdrop-blur-sm"
                >
                  <div className="w-10 h-10 bg-clay/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-clay/20 transition-colors">
                    <item.icon size={18} className="text-clay" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm mb-1">"{item.q}"</div>
                    <div className="text-white/40 text-sm leading-relaxed">{item.a}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CAPABILITIES GRID */}
        <section id="ai-capabilities" className="mb-40 scroll-mt-32">

          <div className="text-center mb-20">
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-clay mb-4">Full-spectrum Intelligence</p>
            <h2 className="text-3xl sm:text-6xl font-sans font-extrabold text-white tracking-tighter leading-tight">
              Every angle of your <br className="hidden sm:block"/><span className="text-white/20 italic font-light">financial life, covered.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CAPABILITIES.map((cap, i) => {
              const c = COLOR_MAP[cap.color];
              return (
                <motion.div
                  key={cap.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className={`group p-8 rounded-[2rem] bg-white/[0.03] border border-white/5 hover:border-clay/30 transition-all hover:shadow-2xl hover:shadow-clay/5 shadow-xl backdrop-blur-md`}
                >
                  <div className={`w-12 h-12 ${c.bg} rounded-2xl flex items-center justify-center ${c.text} mb-6 group-hover:scale-110 transition-transform duration-500`}>
                    <cap.icon size={24} />
                  </div>
                  <h3 className="text-xl font-sans font-extrabold text-white mb-3 tracking-tight">{cap.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed mb-6 min-h-[72px]">{cap.desc}</p>
                  <div className={`flex items-center justify-between border-t border-white/5 pt-5`}>
                    <span className="text-white/10 text-[10px] font-bold uppercase tracking-widest">AI Powered</span>
                    <span className={`${c.text} text-[10px] font-black uppercase tracking-widest`}>{cap.stat}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* PERSONALISATION SECTION */}
        <section id="ai-personalisation" className="mb-40 scroll-mt-32">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-clay mb-6">Profile-to-Profile Intelligence</p>
              <h2 className="text-3xl sm:text-5xl font-sans font-extrabold text-white tracking-tighter leading-tight mb-8">
                Not generic.<br /><span className="text-white/20 italic font-light">Yours specifically.</span>
              </h2>
              <p className="text-white/60 text-xl leading-relaxed mb-10 font-serif">
                Yureka AI continuously learns from your transaction history, card portfolio, and lifestyle goals. Every recommendation gets sharper as it learns what matters to you.
              </p>
              <div className="space-y-4">
                {[
                  'Learns your top 5 spending categories automatically',
                  'Tracks milestone benefits & fee-waiver thresholds in real time',
                  'Adapts recommendations as your portfolio evolves',
                  'Compares your rewards vs India\'s top earners. and closes the gap',
                ].map((point, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-5 h-5 mt-0.5 rounded-full bg-clay/10 border border-clay/20 flex items-center justify-center shrink-0">
                      <Check size={12} className="text-clay" />
                    </div>
                    <span className="text-white/70 text-sm leading-relaxed">{point}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Profile Card Visual */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-8 space-y-6 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-center gap-4 pb-6 border-b border-white/5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-clay to-[#00933b] flex items-center justify-center text-cream font-black text-xl shadow-[0_0_20px_rgba(0,147,59,0.3)]">A</div>
                <div>
                  <div className="text-white font-bold">Aditya Sharma</div>
                  <div className="text-white/30 text-[10px] font-mono uppercase tracking-widest">Yureka AI Profile · Level 4</div>
                </div>
                <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-clay/10 border border-clay/20 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-clay animate-pulse" />
                  <span className="text-clay text-[10px] font-bold uppercase tracking-widest">Active</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Monthly Spend', val: '₹68,000', icon: Wallet },
                  { label: 'Rewards Earned', val: '₹2,890', icon: Gift },
                  { label: 'Points Balance', val: '142,000', icon: Star },
                  { label: 'Optimal Rate', val: '4.2%', icon: Percent },
                ].map(stat => (
                  <div key={stat.label} className="p-4 bg-white/[0.02] rounded-2xl border border-white/5">
                    <stat.icon size={16} className="text-clay/60 mb-2" />
                    <div className="text-white font-sans font-extrabold text-lg tracking-tight">{stat.val}</div>
                    <div className="text-white/20 text-[10px] font-bold uppercase tracking-widest">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-3">Today&apos;s AI Alerts</div>
                {[
                  { msg: 'Use Axis Magnus for ₹12,000 Flipkart order → earn 4,800 pts (₹1,200 value)', type: 'emerald' },
                  { msg: 'Goldback tip: ₹8,000 more spend unlocks this month’s bonus tier', type: 'clay' },
                  { msg: 'Transfer 50,000 Amex MR → Marriott Bonvoy before Jan 31 for best value', type: 'purple' },
                ].map((alert, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${alert.type === 'emerald' ? 'bg-landing-primary' : alert.type === 'clay' ? 'bg-landing-primary' : 'bg-[#E8C468]'}`} />
                    <span className="text-white/70 text-xs leading-relaxed">{alert.msg}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* REWARDX SECTION */}
        <section id="rewardx" className="mb-40 scroll-mt-32">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-[3rem] overflow-hidden border border-white/5 bg-white/[0.02] p-10 md:p-20 shadow-2xl backdrop-blur-md"
          >
            <div className="absolute top-0 right-0 w-96 h-96 bg-landing-primary/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 bg-landing-primary/10 border border-landing-primary/25 rounded-full">
                  <ShoppingBag size={12} className="text-landing-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-landing-primary">Built into Yureka AI</span>
                </div>
                <h2 className="text-4xl md:text-6xl font-sans font-extrabold text-white tracking-tighter leading-tight mb-6">
                  RewardX <br /><span className="font-cooper text-landing-primary">by Yureka</span>
                </h2>
                <p className="text-white/70 text-xl leading-relaxed mb-10 font-sans">
                  Shop smarter with AI-powered gift card stacking. Average checkout saving: <strong className="text-white">11.5%</strong>.
                </p>
                <div className="grid grid-cols-2 gap-4 mb-10">
                  {[
                    { brand: 'Amazon', saving: '12%' },
                    { brand: 'Flipkart', saving: '9%' },
                    { brand: 'Myntra', saving: '14%' },
                    { brand: 'Swiggy', saving: '11%' },
                    { brand: 'Nykaa', saving: '13%' },
                    { brand: 'Uber', saving: '8%' },
                  ].map(b => (
                    <div key={b.brand} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                      <span className="text-white/80 text-sm font-bold">{b.brand}</span>
                      <span className="text-landing-primary text-[10px] font-black uppercase tracking-widest">Save {b.saving}</span>
                    </div>
                  ))}
                </div>
                <Link to={`${basePath}/join-waitlist`} className="inline-flex items-center gap-3 px-8 py-4 bg-landing-primary text-landing-ink font-bold rounded-2xl uppercase tracking-widest text-xs hover:brightness-110 transition-all group shadow-lg shadow-landing-primary/20">
                  Get RewardX Access <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              <div className="hidden lg:block">
                <div className="space-y-4">
                  <div className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-6">Live Cart Optimisation</div>
                  {[
                    { step: '1', action: 'Cart value', amount: '₹4,200', note: 'Amazon order' },
                    { step: '2', action: 'RewardX Gift Card', amount: '−₹378', note: '9% discount' },
                    { step: '3', action: 'ICICI Amazon Pay card', amount: '−₹192', note: '5% cashback' },
                    { step: '4', action: 'Yureka AI reward', amount: '−₹84', note: '2% bonus points' },
                  ].map((row, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className={`flex items-center justify-between p-4 rounded-2xl border ${i === 3 ? 'bg-landing-primary/10 border-landing-primary/25' : 'bg-white/[0.02] border-white/5'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black ${i === 3 ? 'bg-landing-primary text-landing-ink' : 'bg-white/10 text-white/50'}`}>{row.step}</div>
                        <div>
                          <div className={`text-sm font-bold ${i === 3 ? 'text-landing-primary' : 'text-white'}`}>{row.action}</div>
                          <div className="text-white/30 text-[10px] uppercase tracking-widest">{row.note}</div>
                        </div>
                      </div>
                      <div className={`font-black text-sm ${i === 0 ? 'text-white' : 'text-landing-primary'}`}>{row.amount}</div>
                    </motion.div>
                  ))}
                  <div className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.02] border-2 border-landing-primary/30 shadow-2xl shadow-landing-primary/10">
                    <span className="text-white font-sans font-extrabold text-lg">You Pay</span>
                    <div className="text-right">
                      <div className="text-white font-sans font-extrabold text-2xl">₹3,546</div>
                      <div className="text-landing-primary text-[10px] font-bold uppercase tracking-widest">You saved ₹654 · 15.6%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* FINAL CTA */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <div className="relative rounded-[4rem] overflow-hidden bg-white/[0.02] border border-white/5 p-12 md:p-24 shadow-2xl backdrop-blur-md">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #ffffff 1px, transparent 0)', backgroundSize: '40px 40px' }} />
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-landing-primary/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-landing-primary/10 border border-landing-primary/20 rounded-[2rem] mb-10 mx-auto shadow-[0_0_30px_rgba(222,244,110,0.15)]">
                <Brain size={36} className="text-landing-primary" />
              </div>
              <h2 className="text-3xl sm:text-6xl font-sans font-extrabold text-white tracking-tighter leading-tight mb-8">
                Ready for your<br />
                <span className="font-cooper text-landing-primary">AI co-pilot?</span>
              </h2>
              <p className="text-white/70 text-xl max-w-2xl mx-auto leading-relaxed mb-12 font-sans">
                Join the waitlist and get personalised access to Yureka AI, RewardX, and the full Rewards Engine.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  to={`${basePath}/join-waitlist`}
                  className="group relative overflow-hidden bg-landing-primary text-landing-ink font-bold px-12 py-5 rounded-2xl uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-2xl shadow-landing-primary/20 hover:brightness-110 transition-all"
                >
                  <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  <Sparkles size={16} />
                  Join the Waitlist
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to={`${basePath}/brands`}
                  className="border border-white/10 text-white hover:border-landing-primary/40 px-12 py-5 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 backdrop-blur-sm"
                >
                  Explore Partner Brands
                </Link>
              </div>
              <p className="mt-8 text-white/30 text-[10px] font-bold uppercase tracking-[0.5em]">
                Free forever tier available
              </p>
            </div>
          </div>
        </motion.section>

      </div>
    </div>
  );
};

export default YurekaAIPage;
