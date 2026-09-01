import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCheck, Plus, Mic } from 'lucide-react';

const MESSAGES = [
  {
    id: 1, sender: 'Kabir',
    text: "Europe trip next month, ₹2L budget. HDFC Infinia or Axis Magnus for best travel rewards?",
    time: '9:42 AM', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kabir', accent: '#5B8DEF', right: false,
  },
  {
    id: 2, sender: 'Zoya',
    text: "Magnus! 35x points on travel + 12 lounge visits. Got business class to Singapore last month purely from points 🤯",
    time: '9:44 AM', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zoya', accent: '#A855F7', right: false, reaction: '🔥',
  },
  {
    id: 3, sender: 'Arjun',
    text: "Before you pick randomly. try Yureka.One. It audits your actual spend and gives the mathematically optimal card for YOUR profile. Not generic advice.",
    time: '9:45 AM', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Arjun', accent: '#00933b', right: true,
  },
  {
    id: 4, sender: 'Kabir',
    text: "bro this is wild. It's showing HDFC Infinia > Magnus for me. With my dining + fuel spend I earn ₹2,100/mo MORE 👀",
    time: '9:47 AM', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kabir', accent: '#5B8DEF', right: false,
  },
  {
    id: 5, sender: 'Zoya',
    text: "Checking mine... I've been on the wrong card for 2 years 😭 leaving ₹18k/yr on the table",
    time: '9:48 AM', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zoya', accent: '#A855F7', right: false,
  },
  {
    id: 6, sender: 'Arjun',
    text: "Zero bias, no bank sponsorship. Pure math. I've recovered ₹18k in missed rewards already 💰",
    time: '9:49 AM', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Arjun', accent: '#00933b', right: true,
  },
];

const GroupChatAudit: React.FC = () => {
  const [visibleIds, setVisibleIds] = useState<number[]>([]);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let t: NodeJS.Timeout;
    const next = (i: number) => {
      if (i < MESSAGES.length) {
        setTypingUser(MESSAGES[i].sender);
        t = setTimeout(() => {
          setTypingUser(null);
          setVisibleIds(p => [...p, MESSAGES[i].id]);
          t = setTimeout(() => next(i + 1), 750);
        }, 2200);
      } else {
        t = setTimeout(() => { setVisibleIds([]); setTypingUser(null); next(0); }, 5000);
      }
    };
    next(0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [visibleIds, typingUser]);

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ type: 'spring', damping: 22, stiffness: 180 }}
        className="mx-auto w-full max-w-[280px] sm:max-w-[320px] aspect-[9/18.5] rounded-[3rem] border-[8px] border-[#1c1c1c] shadow-[0_60px_120px_-20px_rgba(0,0,0,0.9)] relative overflow-hidden flex flex-col"
        style={{ background: 'linear-gradient(160deg,#141414 0%,#0c0c0c 100%)' }}
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-[#1c1c1c] rounded-b-2xl z-50 flex items-center justify-center">
          <div className="w-8 h-1 bg-white/10 rounded-full" />
        </div>

        {/* Status bar */}
        <div className="pt-7 px-5 pb-1 flex justify-between text-[9px] text-white/20 font-mono">
          <span>9:49</span><span>▲▲ WiFi 🔋</span>
        </div>

        {/* Header */}
        <div className="px-4 pb-3 pt-1 flex items-center gap-3 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
          <div className="flex -space-x-2 shrink-0">
            {MESSAGES.slice(0, 3).map((m, i) => (
              <motion.div key={m.id} initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.07, type: 'spring', stiffness: 400, damping: 18 }}
                className="w-8 h-8 rounded-full overflow-hidden border-2 border-[#141414] shadow-lg"
              >
                <img src={m.avatar} alt={m.sender} className="w-full h-full bg-slate-700" />
              </motion.div>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[12px] font-bold leading-none truncate">The Yield Syndicate</p>
            <div className="flex items-center gap-1.5 mt-1">
              <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                className="w-1.5 h-1.5 bg-clay rounded-full shrink-0" />
              <span className="text-white/30 text-[9px] font-medium uppercase tracking-widest">3 members active</span>
            </div>
          </div>
        </div>

        {/* Chat */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3 py-4 space-y-3.5 scrollbar-hide"
          style={{ background: 'linear-gradient(to bottom, #0f150f 0%, #0c0c0c 60%)' }}
        >
          <AnimatePresence mode="popLayout">
            {MESSAGES.filter(m => visibleIds.includes(m.id)).map(msg => (
              <motion.div
                key={msg.id}
                layout
                initial={{ opacity: 0, y: 14, scale: 0.93, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                transition={{ type: 'spring', damping: 24, stiffness: 300 }}
                className={`flex flex-col ${msg.right ? 'items-end' : 'items-start'}`}
              >
                {!msg.right && (
                  <span className="text-[8px] font-bold uppercase tracking-widest mb-1 px-1" style={{ color: msg.accent + 'BB' }}>
                    {msg.sender}
                  </span>
                )}
                <div className={`max-w-[88%] relative flex flex-col ${msg.right ? 'items-end' : 'items-start'}`}>
                  <motion.div
                    whileInView={{ boxShadow: msg.right ? `0 8px 24px -4px ${msg.accent}30` : '0 4px 16px -4px rgba(0,0,0,0.4)' }}
                    className={`px-3.5 py-2.5 text-[11px] leading-relaxed font-medium rounded-2xl ${
                      msg.right
                        ? 'bg-clay text-cream rounded-br-[4px]'
                        : 'bg-white/[0.07] text-white/85 rounded-bl-[4px] border border-white/[0.07]'
                    }`}
                  >
                    {msg.text}
                  </motion.div>
                  <div className={`flex items-center gap-1 mt-1 px-1 ${msg.right ? 'flex-row' : 'flex-row'}`}>
                    <span className="text-[8px] text-white/20">{msg.time}</span>
                    {msg.right && <CheckCheck size={10} className="text-clay/50" />}
                  </div>
                  {msg.reaction && (
                    <motion.div
                      initial={{ scale: 0, y: 4 }} animate={{ scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 16, delay: 0.3 }}
                      className="absolute -bottom-2 -right-1 text-[10px] bg-white/8 rounded-full px-1.5 py-0.5 backdrop-blur-sm border border-white/10 shadow-sm"
                    >
                      {msg.reaction}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          <AnimatePresence>
            {typingUser && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="flex flex-col items-start"
              >
                <span className="text-[8px] font-bold uppercase tracking-widest mb-1 px-1 text-white/25">{typingUser}</span>
                <div className="bg-white/[0.07] border border-white/[0.07] rounded-2xl rounded-bl-[4px] px-4 py-3 flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <motion.div key={i}
                      animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.85, repeat: Infinity, delay: i * 0.17, ease: 'easeInOut' }}
                      className="w-1.5 h-1.5 bg-clay/60 rounded-full"
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="h-2 shrink-0" />
        </div>

        {/* Input bar */}
        <div className="px-3 py-3 bg-white/5/90 backdrop-blur-xl border-t border-white/[0.05] flex items-center gap-2 shrink-0">
          <motion.div whileHover={{ scale: 1.12 }} className="p-2 text-white/20 cursor-pointer">
            <Plus size={17} />
          </motion.div>
          <div className="flex-1 h-9 bg-white/[0.05] rounded-2xl px-4 flex items-center border border-white/[0.07]">
            <span className="text-[10px] text-white/20">Enter the Syndicate…</span>
          </div>
          <motion.div whileHover={{ scale: 1.12 }} className="w-9 h-9 bg-clay/12 text-clay rounded-2xl flex items-center justify-center border border-clay/20 cursor-pointer">
            <Mic size={15} />
          </motion.div>
        </div>

        {/* Home indicator */}
        <div className="h-6 flex items-center justify-center bg-white/5/90">
          <div className="w-24 h-1 bg-white/10 rounded-full" />
        </div>
      </motion.div>
    </div>
  );
};

export default GroupChatAudit;
