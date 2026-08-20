import React from 'react';
import { Heart, MessageCircle, Repeat, Bookmark, BadgeCheck } from 'lucide-react';
import ImageWithLoader from '@shared/ImageWithLoader';

const tweets = [
  {
    id: '1',
    name: 'Anurag Mundhada',
    handle: '@anu_raag_',
    avatar: 'https://i.pravatar.cc/150?u=anu',
    verified: true,
    content: (<p>@yureka.one is killing it with AI matching. Found me a card with 5% cashback on Swiggy - literally ₹12K saved this year!</p>),
    date: 'Feb 23, 2025',
  },
  {
    id: '2',
    name: 'Garv Malik',
    handle: '@malikgarv',
    avatar: 'https://i.pravatar.cc/150?u=garv',
    verified: true,
    content: (<p>Was hunting for a travel card and discovered @yureka.one. Can't believe the AI matched me with a card that has unlimited lounge access.</p>),
    date: 'Jan 30, 2025',
  },
  {
    id: '3',
    name: 'mathlover',
    handle: '@chaicoder',
    avatar: 'https://i.pravatar.cc/150?u=chai',
    verified: true,
    content: (<p>@yureka.one we desperately need the Chrome extension for UPI payments too! Best fintech tool in India right now.</p>),
    date: 'Jan 29, 2025',
  },
];

const TweetCard = React.memo<{ tweet: any }>(({ tweet }) => (
  <div className="bg-cream border-r border-black/10 p-6 md:p-10 w-[280px] sm:w-[350px] md:w-[450px] flex-shrink-0 flex flex-col h-full hover:bg-[#F2EFE9] transition-colors group">
     <div className="flex gap-3 mb-4 md:mb-6">
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden grayscale group-hover:grayscale-0 transition-all">
             <ImageWithLoader src={tweet.avatar} alt={tweet.name} className="w-full h-full object-cover" />
        </div>
        <div>
           <div className="flex items-center gap-1.5">
              <span className="font-bold text-black text-base md:text-lg font-serif">{tweet.name}</span>
              {tweet.verified && <BadgeCheck size={14} className="text-teal" />}
           </div>
           <div className="text-black/40 text-xs md:text-sm font-mono">{tweet.handle}</div>
        </div>
     </div>
     
     <div className="mb-6 md:mb-8 text-black/80 text-base md:text-xl font-serif italic leading-relaxed">"{tweet.content}"</div>
     <div className="mt-auto pt-4 border-t border-black/5 flex justify-between text-black/30 text-[10px] md:text-xs uppercase tracking-widest font-bold">
         <span>Public Opinion</span>
         <span>{tweet.date}</span>
     </div>
  </div>
));

const SocialProof: React.FC = () => {
  return (
    <section className="py-0 border-b border-black/10 bg-cream overflow-hidden">
        <div className="flex items-stretch animate-marquee hover:[animation-play-state:paused] border-y border-black/10" style={{ animationDuration: '40s' }}>
            {[...tweets, ...tweets, ...tweets, ...tweets].map((tweet, i) => (
                <TweetCard key={`${tweet.id}-${i}`} tweet={tweet} />
            ))}
        </div>
    </section>
  );
};

export default SocialProof;