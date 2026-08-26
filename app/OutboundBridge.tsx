import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { isAffiliateRedirectUrl, mobileWebBrowseUrl, sanitizeBrowseUrl } from '@shared/inAppBrowse'

/** Legacy /go links. redirect instantly, no interstitial UI. */
const OutboundBridge: React.FC = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const dest = sanitizeBrowseUrl(params.get('url'))
  const via = sanitizeBrowseUrl(params.get('via'))
  const affiliate = via && isAffiliateRedirectUrl(via) ? via : null
  const target = affiliate || (dest ? mobileWebBrowseUrl(dest) : null)

  useEffect(() => {
    if (target) {
      window.location.replace(target)
      return
    }
    navigate('/dashboard/home', { replace: true })
  }, [target, navigate])

  return <div className="min-h-dvh bg-[#070707]" />
}

export default OutboundBridge
