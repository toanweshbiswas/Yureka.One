import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'

const CLAY = '#34d399'
const MUTED = 'rgba(255,255,255,0.35)'
const GRID = 'rgba(255,255,255,0.08)'
const FONT = '11px ui-sans-serif, system-ui, sans-serif'

function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = React.useState(0)
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

export function D3MultiLineChart({
  data,
  series,
  height = 240,
}: {
  data: Array<{ date: string; waitlist: number; goldback: number; gifts: number; clicks: number }>
  series: { key: 'waitlist' | 'goldback' | 'gifts' | 'clicks'; label: string; color: string }[]
  height?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const width = useWidth(wrapRef)

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl || width < 40) return
    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()

    const margin = { top: 12, right: 12, bottom: 28, left: 32 }
    const innerW = Math.max(10, width - margin.left - margin.right)
    const innerH = Math.max(10, height - margin.top - margin.bottom)

    const parse = d3.timeParse('%Y-%m-%d')
    const rows = data
      .map((d) => ({ ...d, _date: parse(String(d.date)) as Date }))
      .filter((d) => d._date)

    if (!rows.length) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', MUTED)
        .attr('font', FONT)
        .text('No activity in this window')
      return
    }

    const x = d3.scaleTime()
      .domain(d3.extent(rows, (d) => d._date) as [Date, Date])
      .range([0, innerW])

    const yMax = d3.max(rows, (d) => d3.max(series, (s) => Number(d[s.key] || 0))) || 1
    const y = d3.scaleLinear().domain([0, yMax * 1.15 || 1]).nice().range([innerH, 0])

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    g.append('g')
      .attr('color', MUTED)
      .call(d3.axisLeft(y).ticks(4).tickSize(-innerW).tickFormat((v) => String(v)))
      .call((axis) => {
        axis.select('.domain').remove()
        axis.selectAll('line').attr('stroke', GRID)
        axis.selectAll('text').attr('fill', MUTED).attr('font', FONT)
      })

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .attr('color', MUTED)
      .call(d3.axisBottom(x).ticks(6).tickFormat((d) => d3.timeFormat('%b %d')(d as Date)))
      .call((axis) => {
        axis.select('.domain').attr('stroke', GRID)
        axis.selectAll('line').attr('stroke', GRID)
        axis.selectAll('text').attr('fill', MUTED).attr('font', FONT)
      })

    for (const s of series) {
      const line = d3
        .line<(typeof rows)[0]>()
        .x((d) => x(d._date))
        .y((d) => y(Number(d[s.key] || 0)))
        .curve(d3.curveMonotoneX)
      g.append('path')
        .datum(rows)
        .attr('fill', 'none')
        .attr('stroke', s.color)
        .attr('stroke-width', 2)
        .attr('d', line)
    }

    return () => {
      svg.selectAll('*').remove()
    }
  }, [data, series, width, height])

  return (
    <div ref={wrapRef} className="w-full">
      <svg ref={svgRef} width="100%" height={height} role="img" />
    </div>
  )
}

export function D3DonutChart({
  data,
  colors,
  height = 220,
}: {
  data: { label: string; count: number }[]
  colors: string[]
  height?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const width = useWidth(wrapRef)

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl || width < 40) return
    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()

    const filtered = data.filter((d) => d.count > 0)
    const total = d3.sum(filtered, (d) => d.count)
    const size = Math.min(width * 0.48, height)
    const radius = size / 2 - 4
    const g = svg
      .append('g')
      .attr('transform', `translate(${size / 2 + 8},${height / 2})`)

    if (!total) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', MUTED)
        .attr('font', FONT)
        .text('No data yet')
      return
    }

    const pie = d3.pie<(typeof filtered)[0]>().value((d) => d.count).sort(null)
    const arc = d3.arc<d3.PieArcDatum<(typeof filtered)[0]>>().innerRadius(radius * 0.58).outerRadius(radius)
    const color = d3.scaleOrdinal<string>().domain(filtered.map((d) => d.label)).range(colors)

    g.selectAll('path')
      .data(pie(filtered))
      .join('path')
      .attr('d', arc)
      .attr('fill', (d) => color(d.data.label))

    svg
      .append('text')
      .attr('x', size / 2 + 8)
      .attr('y', height / 2 + 4)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fff')
      .attr('font-size', 18)
      .attr('font-weight', 800)
      .text(total)

    const legend = svg.append('g').attr('transform', `translate(${size + 28}, ${(height - filtered.length * 22) / 2})`)
    filtered.forEach((d, i) => {
      const row = legend.append('g').attr('transform', `translate(0, ${i * 22})`)
      row.append('rect').attr('width', 8).attr('height', 8).attr('rx', 2).attr('fill', color(d.label))
      row
        .append('text')
        .attr('x', 16)
        .attr('y', 8)
        .attr('fill', 'rgba(255,255,255,0.75)')
        .attr('font', FONT)
        .text(`${d.label}  ${d.count}`)
    })

    return () => {
      svg.selectAll('*').remove()
    }
  }, [data, colors, width, height])

  return (
    <div ref={wrapRef} className="w-full">
      <svg ref={svgRef} width="100%" height={height} role="img" />
    </div>
  )
}

export function D3BarChart({
  data,
  valueLabel,
  height = 240,
  color = CLAY,
}: {
  data: { label: string; value: number }[]
  valueLabel?: string
  height?: number
  color?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const width = useWidth(wrapRef)

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl || width < 40) return
    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()

    const rows = data.filter((d) => d.value > 0).slice(0, 8)
    if (!rows.length) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', MUTED)
        .attr('font', FONT)
        .text('No data yet')
      return
    }

    const margin = { top: 8, right: 16, bottom: 28, left: 88 }
    const innerW = Math.max(10, width - margin.left - margin.right)
    const innerH = Math.max(10, height - margin.top - margin.bottom)
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const y = d3
      .scaleBand()
      .domain(rows.map((d) => d.label))
      .range([0, innerH])
      .padding(0.28)
    const x = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (d) => d.value) || 1])
      .nice()
      .range([0, innerW])

    g.append('g')
      .attr('color', MUTED)
      .call(d3.axisLeft(y).tickSize(0))
      .call((axis) => {
        axis.select('.domain').remove()
        axis.selectAll('text').attr('fill', 'rgba(255,255,255,0.7)').attr('font', FONT)
      })

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .attr('color', MUTED)
      .call(d3.axisBottom(x).ticks(4))
      .call((axis) => {
        axis.select('.domain').attr('stroke', GRID)
        axis.selectAll('line').attr('stroke', GRID)
        axis.selectAll('text').attr('fill', MUTED).attr('font', FONT)
      })

    g.selectAll('rect')
      .data(rows)
      .join('rect')
      .attr('y', (d) => y(d.label) || 0)
      .attr('height', y.bandwidth())
      .attr('x', 0)
      .attr('width', (d) => x(d.value))
      .attr('rx', 4)
      .attr('fill', color)

    if (valueLabel) {
      svg
        .append('text')
        .attr('x', margin.left)
        .attr('y', height - 4)
        .attr('fill', MUTED)
        .attr('font', FONT)
        .text(valueLabel)
    }

    return () => {
      svg.selectAll('*').remove()
    }
  }, [data, valueLabel, width, height, color])

  return (
    <div ref={wrapRef} className="w-full">
      <svg ref={svgRef} width="100%" height={height} role="img" />
    </div>
  )
}
