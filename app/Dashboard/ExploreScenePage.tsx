import React, { useMemo } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Tag } from 'lucide-react'
import { getExploreScene } from '@shared/exploreScenes'
import { InAppBrowserFrame } from './InAppBrowser'

const spring = { type: 'spring' as const, bounce: 0, duration: 0.35 }

const ExploreScenePage: React.FC = () => {
  const { sceneId } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const scene = getExploreScene(sceneId)

  const brands = useMemo(
    () => (scene?.brands || []).filter((b) => b.embedUrl),
    [scene],
  )

  const requested = params.get('brand')
  const active = brands.find((b) => b.name === requested) || brands[0]

  if (!scene) return <Navigate to="/dashboard/home" replace />
  if (!brands.length) return <Navigate to={scene.to} replace />
  if (!active) return <Navigate to="/dashboard/home" replace />

  return (
    <InAppBrowserFrame
      src={active.embedUrl}
      title={active.name}
      returnTo="/dashboard/home"
      brands={brands.map((b) => ({ name: b.name, src: b.embedUrl! }))}
      activeBrand={active.name}
      onBrand={(name) => {
        setParams((prev) => {
          const next = new URLSearchParams(prev)
          next.set('brand', name)
          return next
        }, { replace: true })
      }}
      extra={
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          transition={spring}
          onClick={() => navigate(scene.to)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 py-2 text-[13px] font-semibold text-white/70"
        >
          <Tag size={13} /> Coupons
        </motion.button>
      }
    />
  )
}

export default ExploreScenePage
