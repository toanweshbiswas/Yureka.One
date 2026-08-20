export function icon3d(name: string) {
  return `/assets/3dicons/${name}.png`
}

export default function Icon3d({
  name,
  className = 'h-8 w-8 object-contain',
  alt = '',
}: {
  name: string
  className?: string
  alt?: string
}) {
  return (
    <img
      src={icon3d(name)}
      alt={alt}
      className={className}
      draggable={false}
      decoding="async"
    />
  )
}
