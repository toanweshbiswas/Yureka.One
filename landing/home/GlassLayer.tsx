// A transparent "glass-morphed" overlay for media placeholders. a diagonal
// light-catching sheen, a soft top highlight, and an inset hairline ring.
// Drop it in as the LAST child of any `relative overflow-hidden rounded-*`
// container that holds a video or image, so every media card across the site
// shares the same frosted-glass finish.
export default function GlassLayer() {
  return (
    <>
      {/* Diagonal light sheen, like a reflection sliding across glass. */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'linear-gradient(115deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.08) 16%, rgba(255,255,255,0) 34%, rgba(255,255,255,0) 66%, rgba(255,255,255,0.11) 84%, rgba(255,255,255,0) 100%)',
          mixBlendMode: 'overlay',
        }}
      />
      {/* Soft highlight along the top edge. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1/4"
        style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.14), transparent)' }}
      />
      {/* Crisp inset hairline ring (inherits the parent's corner radius). */}
      <div className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] ring-1 ring-inset ring-white/20" />
    </>
  );
}
