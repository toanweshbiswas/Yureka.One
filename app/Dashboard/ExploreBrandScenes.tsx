import React from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import {
  EXPLORE_SCENES,
  sceneOpenPath,
  type ExploreScene,
  type ExploreSceneId,
} from '@shared/exploreScenes'
import { BrandLogo } from '@shared/BrandLogo'

const spring = { type: 'spring' as const, bounce: 0, duration: 0.4 }
const MotionLink = motion.create(Link)

/** Row-major order so left/right cards share a baseline in each row. */
const GRID_ORDER: ExploreSceneId[] = [
  'rides',
  'qcommerce',
  'flights',
  'giftcards',
  'shopping',
  'spend',
]

function SceneCard({
  scene,
  index,
  compact,
}: {
  scene: ExploreScene
  index: number
  compact?: boolean
}) {
  const reduceMotion = useReducedMotion()
  const brands = scene.brands.slice(0, compact ? 3 : 4)

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: reduceMotion ? 0 : Math.min(index * 0.04, 0.16) }}
      className="h-full"
    >
      <MotionLink
        to={sceneOpenPath(scene)}
        whileTap={{ scale: 0.97 }}
        transition={spring}
        className={
          compact
            ? 'group relative isolate flex h-full min-h-[9.75rem] flex-col overflow-hidden rounded-[1.35rem] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/50'
            : 'group relative isolate flex h-full min-h-[10.75rem] flex-col overflow-hidden rounded-[1.5rem] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:min-h-[12.25rem]'
        }
      >
        <div className="absolute inset-0 bg-[#0c0d10]" />

        {/* 3D hero art. same design language on phone + desktop */}
        <motion.div
          className={
            compact
              ? 'pointer-events-none absolute inset-y-0 right-[-4%] flex w-[46%] items-center justify-center origin-right will-change-transform'
              : 'pointer-events-none absolute inset-y-0 right-0 flex w-[48%] items-center justify-center origin-right will-change-transform sm:w-[52%]'
          }
          whileHover={reduceMotion || compact ? undefined : { scale: 1.05 }}
          transition={spring}
        >
          <img
            src={scene.image}
            alt=""
            className={
              compact
                ? 'h-[62%] max-h-[7.25rem] w-auto object-contain drop-shadow-[0_14px_22px_rgba(0,0,0,0.45)]'
                : 'h-[68%] max-h-[9.5rem] w-auto object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.45)] sm:max-h-[10.5rem]'
            }
          />
        </motion.div>

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: compact
              ? 'linear-gradient(105deg, #0c0d10 0%, #0c0d10 48%, rgba(12,13,16,0.55) 68%, transparent 92%)'
              : 'linear-gradient(90deg, #0c0d10 0%, #0c0d10 44%, rgba(12,13,16,0.55) 64%, transparent 90%)',
          }}
        />

        <div
          className={`pointer-events-none absolute inset-0 border border-white/[0.1] ${
            compact ? 'rounded-[1.35rem]' : 'rounded-[1.5rem]'
          }`}
        />

        {brands.length > 0 && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.08] mix-blend-screen">
            {brands.map((brand, i) => (
              <span
                key={brand.domain}
                className={`absolute overflow-hidden rounded-full ${compact ? 'h-10 w-10' : 'h-14 w-14'}`}
                style={{
                  top: `${22 + i * 18}%`,
                  left: `${36 + i * 12}%`,
                }}
              >
                <BrandLogo
                  domain={brand.domain}
                  name={brand.name}
                  className={`flex items-center justify-center ${compact ? 'h-10 w-10' : 'h-14 w-14'}`}
                  imgClassName={compact ? 'h-10 w-10 object-contain' : 'h-14 w-14 object-contain'}
                />
              </span>
            ))}
          </div>
        )}

        {scene.badge && (
          <span
            className={`absolute z-20 rounded-full bg-black/40 font-semibold tracking-[0.04em] text-white/90 backdrop-blur-xl ${
              compact
                ? 'right-2 top-2 px-2 py-0.5 text-[9px]'
                : 'right-3 top-3 px-2.5 py-1 text-[10px]'
            }`}
          >
            {scene.badge}
          </span>
        )}

        <div
          className={
            compact
              ? 'relative z-10 flex min-h-0 flex-1 flex-col px-3 pb-7 pt-3'
              : 'relative z-10 flex min-h-0 flex-1 flex-col px-4 pb-8 pt-4 sm:px-5 sm:pt-5'
          }
        >
          <h3
            className={
              compact
                ? 'max-w-[8.5rem] text-[0.95rem] font-semibold leading-[1.12] tracking-[-0.03em] text-white drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]'
                : 'min-h-[2.8rem] max-w-[11rem] text-[1.1rem] font-semibold leading-[1.1] tracking-[-0.035em] text-white drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)] sm:min-h-[3.9rem] sm:max-w-[11.5rem] sm:text-[1.28rem] sm:leading-[1.05]'
            }
          >
            {scene.title}
          </h3>

          <div className={`flex items-center ${compact ? 'mt-2 h-6' : 'mt-2.5 h-8'}`}>
            {brands.length > 0 ? (
              brands.map((brand, i) => (
                <span
                  key={brand.domain}
                  className={`flex items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/90 backdrop-blur-md ${
                    compact ? 'h-6 w-6' : 'h-8 w-8'
                  }`}
                  style={{ marginLeft: i === 0 ? 0 : compact ? -6 : -8, zIndex: brands.length - i }}
                  title={brand.name}
                >
                  <BrandLogo
                    domain={brand.domain}
                    name={brand.name}
                    className={`flex items-center justify-center ${compact ? 'h-4 w-4' : 'h-6 w-6'}`}
                    imgClassName={
                      compact ? 'h-4 w-4 object-contain p-px' : 'h-6 w-6 object-contain p-0.5'
                    }
                    alt={brand.name}
                  />
                </span>
              ))
            ) : (
              <span className={compact ? 'h-6' : 'h-8'} aria-hidden />
            )}
          </div>

          {!compact && (
            <p className="mt-2 min-h-[2.4rem] max-w-[14rem] text-[12px] font-medium leading-snug text-white/70">
              {scene.subtitle}
            </p>
          )}

          <div className={`mt-auto ${compact ? 'pt-2' : 'pt-3'}`}>
            <span
              className={`inline-flex items-center justify-center rounded-full bg-white text-black shadow-[0_10px_24px_rgba(0,0,0,0.28)] transition-transform duration-100 ease-out group-active:scale-[0.94] ${
                compact ? 'h-8 w-8' : 'h-10 w-10 sm:h-11 sm:w-11'
              }`}
            >
              <ArrowRight size={compact ? 14 : 16} />
            </span>
          </div>
        </div>

        <div
          className={`absolute inset-x-0 bottom-0 z-10 flex items-center justify-center overflow-hidden bg-black/20 backdrop-blur-xl ${
            compact ? 'h-6' : 'h-7'
          }`}
        >
          {scene.ribbon ? (
            <p
              className={`text-center font-semibold tracking-[0.18em] text-white/75 ${
                compact ? 'text-[9px]' : 'text-[10px]'
              }`}
            >
              {scene.ribbon}
            </p>
          ) : (
            <span className="sr-only">Open</span>
          )}
        </div>
      </MotionLink>
    </motion.div>
  )
}

type Props = {
  /** Phone home: tighter 2-col tiles that keep the desktop scene craft. */
  compact?: boolean
}

const ExploreBrandScenes: React.FC<Props> = ({ compact = false }) => {
  const byId = new Map(EXPLORE_SCENES.map((s) => [s.id, s]))
  const ordered = GRID_ORDER.map((id) => byId.get(id)).filter(Boolean) as ExploreScene[]

  return (
    <div
      className={
        compact
          ? 'grid grid-cols-2 items-stretch gap-2.5'
          : 'grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-stretch'
      }
    >
      {ordered.map((scene, index) => (
        <SceneCard key={scene.id} scene={scene} index={index} compact={compact} />
      ))}
    </div>
  )
}

export default ExploreBrandScenes
