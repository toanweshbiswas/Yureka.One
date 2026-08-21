import React from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import {
  EXPLORE_SCENES,
  sceneOpenPath,
  type ExploreScene,
} from '@shared/exploreScenes'
import { BrandLogo } from '@shared/BrandLogo'

const spring = { type: 'spring' as const, bounce: 0, duration: 0.4 }
const MotionLink = motion.create(Link)

function SceneCard({ scene, index }: { scene: ExploreScene; index: number }) {
  const reduceMotion = useReducedMotion()
  const hero = scene.size === 'hero'

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: reduceMotion ? 0 : Math.min(index * 0.05, 0.18) }}
    >
      <MotionLink
        to={sceneOpenPath(scene)}
        whileTap={{ scale: 0.97 }}
        transition={spring}
        className={`group relative isolate block overflow-hidden rounded-[1.5rem] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
          hero ? 'min-h-[200px] sm:min-h-[220px]' : 'min-h-[140px] sm:min-h-[148px]'
        }`}
      >
        <div className="absolute inset-0 bg-[#0c0d10]" />

        <motion.div
          className="pointer-events-none absolute inset-y-0 right-0 flex w-[52%] items-center justify-center origin-right will-change-transform"
          whileHover={reduceMotion ? undefined : { scale: 1.06 }}
          transition={spring}
        >
          <img
            src={scene.image}
            alt=""
            className={`${hero ? 'h-[78%] max-h-[220px]' : 'h-[72%] max-h-[150px]'} w-auto object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.45)]`}
          />
        </motion.div>

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, #0c0d10 0%, #0c0d10 42%, rgba(12,13,16,0.55) 62%, transparent 88%)',
          }}
        />

        <div className="pointer-events-none absolute inset-0 border border-white/[0.1] rounded-[1.7rem]" />

        {scene.brands.length > 0 && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.12] mix-blend-screen">
            {scene.brands.map((brand, i) => (
              <span
                key={brand.domain}
                className="absolute h-16 w-16 overflow-hidden rounded-full"
                style={{
                  top: `${22 + i * 20}%`,
                  left: `${36 + i * 14}%`,
                }}
              >
                <BrandLogo
                  domain={brand.domain}
                  name={brand.name}
                  className="flex h-16 w-16 items-center justify-center"
                  imgClassName="h-16 w-16 object-contain"
                />
              </span>
            ))}
          </div>
        )}

        <div className={`relative z-10 flex h-full flex-col ${hero ? 'p-5 sm:p-6' : 'p-4'} ${scene.ribbon ? 'pb-9' : ''}`}>
          <div className="flex items-start justify-between gap-3">
            <h3
              className={`max-w-[12rem] font-semibold leading-[1.02] tracking-[-0.035em] drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)] ${
                hero ? 'text-[1.7rem] sm:text-[1.9rem]' : 'text-[1.28rem] sm:text-[1.38rem]'
              }`}
            >
              {scene.title}
            </h3>
            {scene.badge && (
              <span className="rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-semibold tracking-[0.04em] text-white/90 backdrop-blur-xl">
                {scene.badge}
              </span>
            )}
          </div>

          {scene.brands.length > 0 && (
            <div className="mt-3 flex items-center">
              {scene.brands.map((brand, i) => (
                <span
                  key={brand.domain}
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/90 backdrop-blur-md"
                  style={{ marginLeft: i === 0 ? 0 : -8, zIndex: scene.brands.length - i }}
                  title={brand.name}
                >
                  <BrandLogo
                    domain={brand.domain}
                    name={brand.name}
                    className="flex h-5 w-5 items-center justify-center"
                    imgClassName="h-5 w-5 object-contain"
                    alt={brand.name}
                  />
                </span>
              ))}
            </div>
          )}

          <p className={`mt-2 max-w-[15rem] font-medium leading-relaxed text-white/72 ${hero ? 'text-[13px]' : 'text-[12px]'}`}>
            {scene.subtitle}
          </p>

          <div className="mt-auto pt-4">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-[0_10px_24px_rgba(0,0,0,0.28)] transition-transform duration-100 ease-out group-active:scale-[0.94]">
              <ArrowRight size={17} />
            </span>
          </div>
        </div>

        {scene.ribbon && (
          <div className="absolute inset-x-0 bottom-0 z-10 overflow-hidden bg-black/25 py-1.5 backdrop-blur-xl">
            <p className="text-center text-[10px] font-semibold tracking-[0.18em] text-white/80">
              {scene.ribbon}
            </p>
          </div>
        )}
      </MotionLink>
    </motion.div>
  )
}

const ExploreBrandScenes: React.FC = () => {
  const heroes = EXPLORE_SCENES.filter((s) => s.size === 'hero')
  const tiles = EXPLORE_SCENES.filter((s) => s.size === 'tile')

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="grid gap-3">
        {heroes.map((scene, index) => (
          <SceneCard key={scene.id} scene={scene} index={index} />
        ))}
      </div>
      <div className="grid gap-3">
        {tiles.map((scene, index) => (
          <SceneCard key={scene.id} scene={scene} index={index + heroes.length} />
        ))}
      </div>
    </div>
  )
}

export default ExploreBrandScenes
