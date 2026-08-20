const LOGO_SRC = '/logos/yureka-logo.png'

export default function YurekaBrandMark({
  className = 'h-11 w-11 rounded-2xl object-cover',
  alt = 'Yureka',
}: {
  className?: string
  alt?: string
}) {
  return (
    <img
      src={LOGO_SRC}
      alt={alt}
      className={className}
      draggable={false}
      decoding="async"
    />
  )
}
