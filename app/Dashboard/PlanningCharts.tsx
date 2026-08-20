import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useReducedMotion } from 'motion/react'
import { PLANNING_CATEGORY_META } from '@backend/lib/planning/types'
import type { PlanningAnalysis, PlanningCategory } from '@backend/lib/planning/types'

const FALLBACK = PLANNING_CATEGORY_META.other

function categoryColor(category: PlanningCategory) {
  return PLANNING_CATEGORY_META[category]?.color || FALLBACK.color
}

function categoryLabel(category: PlanningCategory) {
  return PLANNING_CATEGORY_META[category]?.label || FALLBACK.label
}

const MUTED = 'rgba(255,255,255,0.38)'
const GRID = 'rgba(255,255,255,0.08)'
const FONT = '11px ui-sans-serif, system-ui, sans-serif'

function compactInr(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`
  return `₹${Math.round(n)}`
}

function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [ref])
  return width
}

export function PlanningDonut({
  data,
  height = 220,
}: {
  data: PlanningAnalysis['byCategory']
  height?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const width = useWidth(wrapRef)
  const reduceMotion = useReducedMotion()
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null)

  const rows = useMemo(
    () => data.filter((d) => d.actualInr > 0).map((d) => ({ ...d, label: categoryLabel(d.category) })),
    [data],
  )
  const total = rows.reduce((sum, d) => sum + d.actualInr, 0)

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl || width < 40) return
    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()
    const duration = reduceMotion ? 0 : 400
    const size = Math.min(width * 0.46, height)
    const radius = Math.max(28, size / 2 - 6)

    if (!total) {
      svg.append('text').attr('x', width / 2).attr('y', height / 2).attr('text-anchor', 'middle').attr('fill', MUTED).attr('font', FONT).text('Add a spend to see the split')
      return
    }

    const pie = d3.pie<(typeof rows)[0]>().value((d) => d.actualInr).sort(null).padAngle(0.02)
    const arc = d3.arc<d3.PieArcDatum<(typeof rows)[0]>>().innerRadius(radius * 0.62).outerRadius(radius).cornerRadius(3)
    const hoverArc = d3.arc<d3.PieArcDatum<(typeof rows)[0]>>().innerRadius(radius * 0.62).outerRadius(radius + 5).cornerRadius(3)
    const g = svg.append('g').attr('transform', `translate(${size / 2 + 4},${height / 2})`)

    const paths = g.selectAll('path').data(pie(rows)).join('path').attr('fill', (d) => categoryColor(d.data.category)).style('cursor', 'pointer')
    paths
      .transition()
      .duration(duration)
      .ease(d3.easeCubicOut)
      .attrTween('d', function (d) {
        const i = d3.interpolate({ startAngle: d.startAngle, endAngle: d.startAngle }, d)
        return (t) => arc(i(t)) || ''
      })

    paths
      .on('pointerenter', function (event, d) {
        d3.select(this).transition().duration(160).attr('d', hoverArc(d) || '')
        setTip({ x: event.offsetX, y: event.offsetY, text: `${d.data.label}  ${compactInr(d.data.actualInr)}` })
      })
      .on('pointermove', (event) => {
        setTip((prev) => (prev ? { ...prev, x: event.offsetX, y: event.offsetY } : prev))
      })
      .on('pointerleave', function (_event, d) {
        d3.select(this).transition().duration(160).attr('d', arc(d) || '')
        setTip(null)
      })

    svg.append('text').attr('x', size / 2 + 4).attr('y', height / 2 - 4).attr('text-anchor', 'middle').attr('fill', '#fff').attr('font-size', 18).attr('font-weight', 800).text(compactInr(total))
    svg.append('text').attr('x', size / 2 + 4).attr('y', height / 2 + 14).attr('text-anchor', 'middle').attr('fill', MUTED).attr('font', FONT).text('This month')

    const legend = svg.append('g').attr('transform', `translate(${size + 22}, ${(height - rows.length * 22) / 2})`)
    rows.forEach((d, i) => {
      const row = legend.append('g').attr('transform', `translate(0, ${i * 22})`)
      row.append('rect').attr('width', 8).attr('height', 8).attr('rx', 2).attr('fill', categoryColor(d.category))
      row.append('text').attr('x', 16).attr('y', 9).attr('fill', 'rgba(255,255,255,0.72)').attr('font', FONT).text(`${d.label}  ${compactInr(d.actualInr)}`)
    })

    return () => {
      svg.selectAll('*').remove()
    }
  }, [rows, total, width, height, reduceMotion])

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg ref={svgRef} width="100%" height={height} role="img" aria-label="Spend by category" />
      {tip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg bg-black/80 px-2.5 py-1.5 text-[11px] font-semibold text-white"
          style={{ left: tip.x + 10, top: tip.y - 28 }}
        >
          {tip.text}
        </div>
      )}
    </div>
  )
}

export function PlanningDailyArea({
  data,
  height = 220,
}: {
  data: PlanningAnalysis['byDay']
  height?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const width = useWidth(wrapRef)
  const reduceMotion = useReducedMotion()
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null)

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl || width < 40) return
    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()
    const duration = reduceMotion ? 0 : 420
    const margin = { top: 12, right: 12, bottom: 26, left: 40 }
    const innerW = Math.max(10, width - margin.left - margin.right)
    const innerH = Math.max(10, height - margin.top - margin.bottom)
    const parse = d3.timeParse('%Y-%m-%d')
    const rows = data.map((d) => ({ ...d, _date: parse(d.date) as Date })).filter((d) => d._date)
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    if (!rows.some((d) => d.amountInr > 0)) {
      svg.append('text').attr('x', width / 2).attr('y', height / 2).attr('text-anchor', 'middle').attr('fill', MUTED).attr('font', FONT).text('Daily spend will plot here')
      return
    }

    const x = d3.scaleTime().domain(d3.extent(rows, (d) => d._date) as [Date, Date]).range([0, innerW])
    const y = d3.scaleLinear().domain([0, (d3.max(rows, (d) => d.amountInr) || 1) * 1.15]).nice().range([innerH, 0])

    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickSize(-innerW).tickFormat((v) => compactInr(Number(v))))
      .call((axis) => {
        axis.select('.domain').remove()
        axis.selectAll('line').attr('stroke', GRID)
        axis.selectAll('text').attr('fill', MUTED).attr('font', FONT)
      })
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat((d) => d3.timeFormat('%d')(d as Date)))
      .call((axis) => {
        axis.select('.domain').attr('stroke', GRID)
        axis.selectAll('line').attr('stroke', GRID)
        axis.selectAll('text').attr('fill', MUTED).attr('font', FONT)
      })

    const area = d3.area<(typeof rows)[0]>().x((d) => x(d._date)).y0(innerH).y1((d) => y(d.amountInr)).curve(d3.curveMonotoneX)
    const line = d3.line<(typeof rows)[0]>().x((d) => x(d._date)).y((d) => y(d.amountInr)).curve(d3.curveMonotoneX)

    const areaPath = g.append('path').datum(rows).attr('fill', 'rgba(52,211,153,0.18)').attr('d', area)
    const linePath = g.append('path').datum(rows).attr('fill', 'none').attr('stroke', '#34d399').attr('stroke-width', 2).attr('d', line)

    if (duration) {
      const lineLen = (linePath.node() as SVGPathElement | null)?.getTotalLength() || 0
      linePath.attr('stroke-dasharray', `${lineLen} ${lineLen}`).attr('stroke-dashoffset', lineLen).transition().duration(duration).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0)
      areaPath.attr('opacity', 0).transition().duration(duration).ease(d3.easeCubicOut).attr('opacity', 1)
    }

    const hit = g.append('rect').attr('width', innerW).attr('height', innerH).attr('fill', 'transparent').style('cursor', 'crosshair')
    const rule = g.append('line').attr('stroke', 'rgba(255,255,255,0.25)').attr('stroke-dasharray', '3 4').attr('y1', 0).attr('y2', innerH).style('display', 'none')
    const dot = g.append('circle').attr('r', 4).attr('fill', '#34d399').style('display', 'none')

    hit
      .on('pointermove', (event) => {
        const [px] = d3.pointer(event)
        const date = x.invert(px)
        const bisect = d3.bisector<(typeof rows)[0], Date>((d) => d._date).center
        const i = bisect(rows, date)
        const row = rows[i]
        if (!row) return
        rule.style('display', null).attr('x1', x(row._date)).attr('x2', x(row._date))
        dot.style('display', null).attr('cx', x(row._date)).attr('cy', y(row.amountInr))
        setTip({
          x: event.offsetX,
          y: event.offsetY,
          text: `${d3.timeFormat('%d %b')(row._date)}  ${compactInr(row.amountInr)}`,
        })
      })
      .on('pointerleave', () => {
        rule.style('display', 'none')
        dot.style('display', 'none')
        setTip(null)
      })

    return () => {
      svg.selectAll('*').remove()
    }
  }, [data, width, height, reduceMotion])

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg ref={svgRef} width="100%" height={height} role="img" aria-label="Daily spend this month" />
      {tip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg bg-black/80 px-2.5 py-1.5 text-[11px] font-semibold text-white"
          style={{ left: tip.x + 10, top: Math.max(4, tip.y - 28) }}
        >
          {tip.text}
        </div>
      )}
    </div>
  )
}

export function PlanningMonthBars({
  data,
  height = 200,
}: {
  data: PlanningAnalysis['byMonth']
  height?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const width = useWidth(wrapRef)
  const reduceMotion = useReducedMotion()
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null)

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl || width < 40) return
    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()
    const duration = reduceMotion ? 0 : 400
    const margin = { top: 10, right: 8, bottom: 28, left: 40 }
    const innerW = Math.max(10, width - margin.left - margin.right)
    const innerH = Math.max(10, height - margin.top - margin.bottom)
    const parse = d3.timeParse('%Y-%m')
    const rows = data.map((d) => ({
      ...d,
      label: d3.timeFormat('%b')(parse(d.month) as Date),
    }))
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3.scaleBand().domain(rows.map((d) => d.label)).range([0, innerW]).padding(0.32)
    const y = d3.scaleLinear().domain([0, (d3.max(rows, (d) => d.amountInr) || 1) * 1.12]).nice().range([innerH, 0])

    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickSize(-innerW).tickFormat((v) => compactInr(Number(v))))
      .call((axis) => {
        axis.select('.domain').remove()
        axis.selectAll('line').attr('stroke', GRID)
        axis.selectAll('text').attr('fill', MUTED).attr('font', FONT)
      })
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call((axis) => {
        axis.select('.domain').attr('stroke', GRID)
        axis.selectAll('text').attr('fill', MUTED).attr('font', FONT)
      })

    const bars = g
      .selectAll('rect')
      .data(rows)
      .join('rect')
      .attr('x', (d) => x(d.label) || 0)
      .attr('width', x.bandwidth())
      .attr('y', innerH)
      .attr('height', 0)
      .attr('rx', 6)
      .attr('fill', '#34d399')
      .style('cursor', 'pointer')

    bars
      .transition()
      .duration(duration)
      .ease(d3.easeCubicOut)
      .attr('y', (d) => y(d.amountInr))
      .attr('height', (d) => innerH - y(d.amountInr))

    bars
      .on('pointerenter', (event, d) => {
        d3.select(event.currentTarget).attr('fill', '#6ee7b7')
        setTip({ x: event.offsetX, y: event.offsetY, text: `${d.label}  ${compactInr(d.amountInr)}` })
      })
      .on('pointermove', (event) => setTip((prev) => (prev ? { ...prev, x: event.offsetX, y: event.offsetY } : prev)))
      .on('pointerleave', (event) => {
        d3.select(event.currentTarget).attr('fill', '#34d399')
        setTip(null)
      })

    return () => {
      svg.selectAll('*').remove()
    }
  }, [data, width, height, reduceMotion])

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg ref={svgRef} width="100%" height={height} role="img" aria-label="Six month spend" />
      {tip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg bg-black/80 px-2.5 py-1.5 text-[11px] font-semibold text-white"
          style={{ left: tip.x + 10, top: Math.max(4, tip.y - 28) }}
        >
          {tip.text}
        </div>
      )}
    </div>
  )
}
