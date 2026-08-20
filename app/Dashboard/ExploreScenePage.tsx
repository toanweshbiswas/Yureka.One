import React from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { getExploreScene } from '@shared/exploreScenes'

/** Old /dashboard/explore/:id links → the same marketplace scene as the website. */
const ExploreScenePage: React.FC = () => {
  const { sceneId } = useParams()
  const scene = getExploreScene(sceneId)
  if (!scene) return <Navigate to="/dashboard/home" replace />
  return <Navigate to={scene.to} replace />
}

export default ExploreScenePage
