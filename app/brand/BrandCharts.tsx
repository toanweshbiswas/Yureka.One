import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { BrandDayPoint } from '@backend/lib/brand/types'

const CLAY = '#34d399'
const MUTED = 'rgba(255,255,255,0.35)'
const GRID = 'rgba(255,255,255,0.08)'
const FONT = '11px ui-sans-serif, system-ui, sans-serif'

export function BrandActivityChart({ data, height = 220 }: { data: BrandDayPoint[]; height?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [width, setWidth] = React.useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl || width < 40) return
    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()
    const margin = { top: 12, right: 12, bottom: 28, left: 32 }
    const innerW = Math.max(10, width - margin.left - margin.right)
    const innerH = Math.max(10, height - margin.top - margin.bottom)
    const parse = d3.timeParse('%Y-%m-%d')
    const rows = data.map((d) => ({ ...d, _date: parse(String(d.date)) as Date })).filter((d) => d._date)
    if (!rows.some((d) => d.clicks || d.copies)) {
      svg.append('text').attr('x', width / 2).attr('y', height / 2).attr('text-anchor', 'middle').attr('fill', MUTED).attr('font', FONT).text('No member activity yet')
      return
    }
    const x = d3.scaleTime().domain(d3.extent(rows, (d) => d._date) as [Date, Date]).range([0, innerW])
    const yMax = d3.max(rows, (d) => Math.max(d.clicks, d.copies)) || 1
    const y = d3.scaleLinear().domain([0, yMax * 1.15]).nice().range([innerH, 0])
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
    g.append('g').call(d3.axisLeft(y).ticks(4).tickSize(-innerW)).call((axis) => {
      axis.select('.domain').remove()
      axis.selectAll('line').attr('stroke', GRID)
      axis.selectAll('text').attr('fill', MUTED).attr('font', FONT)
    })
    g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(6).tickFormat((d) => d3.timeFormat('%b %d')(d as Date))).call((axis) => {
      axis.select('.domain').attr('stroke', GRID)
      axis.selectAll('text').attr('fill', MUTED).attr('font', FONT)
    })
    const clicks = d3.line<(typeof rows)[0]>().x((d) => x(d._date)).y((d) => y(d.clicks)).curve(d3.curveMonotoneX)
    const copies = d3.line<(typeof rows)[0]>().x((d) => x(d._date)).y((d) => y(d.copies)).curve(d3.curveMonotoneX)
    g.append('path').datum(rows).attr('fill', 'none').attr('stroke', CLAY).attr('stroke-width', 2).attr('d', clicks)
    g.append('path').datum(rows).attr('fill', 'none').attr('stroke', '#60a5fa').attr('stroke-width', 2).attr('d', copies)
  }, [data, width, height])

  return (
    <div ref={wrapRef} className="w-full">
      <svg ref={svgRef} width="100%" height={height} role="img" aria-label="Clicks and coupon copies over 30 days" />
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35 mt-2">
        <span className="text-clay">Clicks</span> · <span className="text-sky-300">Copies</span> · last 30 days
      </p>
    </div>
  )
}
