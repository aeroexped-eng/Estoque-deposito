import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { STREETS, STREET_META } from '../constants/wmsConstants';

export interface ImportHistorySnapshot {
  id: string;
  importIndex: number;
  label: string;
  dateStr: string;
  fullDateTime: string;
  timestamp: number;
  fileName?: string;
  streetOccupancyMap: Record<string, number>;
  globalOccupancyPct: number;
  totalPieces: number;
  totalSkus: number;
}

export interface OccupancyEvolutionChartProps {
  selectedStreet: string;
  onSelectStreet?: (rua: string) => void;
  importHistory: ImportHistorySnapshot[];
  onAddSnapshot?: () => void;
  onResetHistory?: () => void;
}

interface HoveredPointInfo {
  x: number;
  y: number;
  label: string;
  fullDateTime: string;
  occupancyPct: number;
  prevOccupancyPct: number | null;
  globalOccupancyPct: number;
  totalPieces: number;
  fileName?: string;
}

export const OccupancyEvolutionChart: React.FC<OccupancyEvolutionChartProps> = ({
  selectedStreet,
  onSelectStreet,
  importHistory,
  onAddSnapshot,
  onResetHistory
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(680);
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPointInfo | null>(null);
  const [activeStreet, setActiveStreet] = useState<string>(selectedStreet);

  // Sync internal activeStreet with selectedStreet prop when prop changes
  useEffect(() => {
    setActiveStreet(selectedStreet);
  }, [selectedStreet]);

  // Measure container width responsively
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 200) {
          setContainerWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Data formatted for active street
  const chartPoints = useMemo(() => {
    if (!importHistory || importHistory.length === 0) return [];

    return importHistory.map((snap, idx) => {
      const pct =
        snap.streetOccupancyMap && snap.streetOccupancyMap[activeStreet] !== undefined
          ? snap.streetOccupancyMap[activeStreet]
          : snap.globalOccupancyPct;

      const prevSnap = idx > 0 ? importHistory[idx - 1] : null;
      const prevPct =
        prevSnap && prevSnap.streetOccupancyMap && prevSnap.streetOccupancyMap[activeStreet] !== undefined
          ? prevSnap.streetOccupancyMap[activeStreet]
          : prevSnap
          ? prevSnap.globalOccupancyPct
          : null;

      return {
        ...snap,
        occupancyPct: Math.max(0, Math.min(100, pct)),
        prevOccupancyPct: prevPct !== null ? Math.max(0, Math.min(100, prevPct)) : null
      };
    });
  }, [importHistory, activeStreet]);

  // Metrics summary for active street
  const metrics = useMemo(() => {
    if (chartPoints.length === 0) {
      return { current: 0, first: 0, delta: 0, min: 0, max: 0, trend: 'stable' };
    }
    const current = chartPoints[chartPoints.length - 1].occupancyPct;
    const first = chartPoints[0].occupancyPct;
    const delta = current - first;
    const pcts = chartPoints.map(p => p.occupancyPct);
    const min = Math.min(...pcts);
    const max = Math.max(...pcts);
    const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable';
    return { current, first, delta, min, max, trend };
  }, [chartPoints]);

  // Color theme based on current rate
  const colorTheme = useMemo(() => {
    const p = metrics.current;
    if (p >= 88) {
      return {
        stroke: '#f43f5e',
        gradientStart: 'rgba(244, 63, 94, 0.45)',
        gradientEnd: 'rgba(244, 63, 94, 0.02)',
        pointFill: '#e11d48',
        label: 'Crítica (Saturada)',
        badgeClass: 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
      };
    }
    if (p >= 70) {
      return {
        stroke: '#f97316',
        gradientStart: 'rgba(249, 115, 22, 0.45)',
        gradientEnd: 'rgba(249, 115, 22, 0.02)',
        pointFill: '#ea580c',
        label: 'Alta Ocupação',
        badgeClass: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/40'
      };
    }
    if (p >= 45) {
      return {
        stroke: '#eab308',
        gradientStart: 'rgba(234, 179, 8, 0.40)',
        gradientEnd: 'rgba(234, 179, 8, 0.02)',
        pointFill: '#ca8a04',
        label: 'Moderada / Balanceada',
        badgeClass: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
      };
    }
    return {
      stroke: '#3b82f6',
      gradientStart: 'rgba(59, 130, 246, 0.40)',
      gradientEnd: 'rgba(59, 130, 246, 0.02)',
      pointFill: '#2563eb',
      label: 'Normal / Disponível',
      badgeClass: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/40'
    };
  }, [metrics.current]);

  // Render D3 chart
  useEffect(() => {
    if (!svgRef.current || chartPoints.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = Math.max(340, containerWidth);
    const height = 210;
    const margin = { top: 22, right: 35, bottom: 44, left: 45 };

    // Defs & Gradients
    const defs = svg.append('defs');

    // Area Gradient
    const gradientId = `occ-gradient-${activeStreet}`;
    const linearGradient = defs
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    linearGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', colorTheme.stroke)
      .attr('stop-opacity', 0.42);

    linearGradient
      .append('stop')
      .attr('offset', '75%')
      .attr('stop-color', colorTheme.stroke)
      .attr('stop-opacity', 0.08);

    linearGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', colorTheme.stroke)
      .attr('stop-opacity', 0.0);

    // Glow filter for line and latest point
    const filter = defs.append('filter').attr('id', 'line-glow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    filter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'blur');
    filter.append('feMerge').selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .enter()
      .append('feMergeNode')
      .attr('in', d => d);

    // Scales
    const labels = chartPoints.map(p => p.label);
    const xScale = d3
      .scalePoint<string>()
      .domain(labels)
      .range([margin.left, width - margin.right])
      .padding(0.35);

    const yScale = d3
      .scaleLinear()
      .domain([0, 100])
      .range([height - margin.bottom, margin.top]);

    // Grid lines (horizontal dotted lines at 25%, 50%, 75%, 100%)
    const gridTicks = [25, 50, 75, 100];
    const gridGroup = svg.append('g').attr('class', 'grid-lines');

    gridTicks.forEach(tickVal => {
      const y = yScale(tickVal);
      gridGroup
        .append('line')
        .attr('x1', margin.left)
        .attr('x2', width - margin.right)
        .attr('y1', y)
        .attr('y2', y)
        .attr('stroke', 'currentColor')
        .attr('stroke-opacity', 0.08)
        .attr('stroke-dasharray', '3,3');
    });

    // 85% Critical Capacity Reference Line
    const criticalY = yScale(85);
    const critGroup = svg.append('g').attr('class', 'critical-reference');

    critGroup
      .append('line')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', criticalY)
      .attr('y2', criticalY)
      .attr('stroke', '#f43f5e')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '4,4')
      .attr('stroke-opacity', 0.55);

    critGroup
      .append('text')
      .attr('x', width - margin.right)
      .attr('y', criticalY - 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#f43f5e')
      .attr('font-size', '9px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'monospace')
      .attr('opacity', 0.85)
      .text('85% Alerta Saturação');

    // Area Generator
    const areaGenerator = d3
      .area<(typeof chartPoints)[0]>()
      .x(d => xScale(d.label) || margin.left)
      .y0(yScale(0))
      .y1(d => yScale(d.occupancyPct))
      .curve(chartPoints.length > 2 ? d3.curveMonotoneX : d3.curveLinear);

    // Line Generator
    const lineGenerator = d3
      .line<(typeof chartPoints)[0]>()
      .x(d => xScale(d.label) || margin.left)
      .y(d => yScale(d.occupancyPct))
      .curve(chartPoints.length > 2 ? d3.curveMonotoneX : d3.curveLinear);

    // Append Area with fill
    svg
      .append('path')
      .datum(chartPoints)
      .attr('fill', `url(#${gradientId})`)
      .attr('d', areaGenerator)
      .attr('pointer-events', 'none');

    // Append Line
    svg
      .append('path')
      .datum(chartPoints)
      .attr('fill', 'none')
      .attr('stroke', colorTheme.stroke)
      .attr('stroke-width', 2.8)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .attr('filter', 'url(#line-glow)')
      .attr('d', lineGenerator)
      .attr('pointer-events', 'none');

    // X Axis
    const xAxis = d3
      .axisBottom(xScale)
      .tickSize(0)
      .tickPadding(10)
      .tickFormat((d, i) => {
        const item = chartPoints[i];
        return item ? item.dateStr : d;
      });

    const xAxisGroup = svg
      .append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(xAxis);

    xAxisGroup.select('.domain').attr('stroke', 'currentColor').attr('stroke-opacity', 0.15);
    xAxisGroup
      .selectAll('text')
      .attr('fill', 'currentColor')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('font-weight', '600')
      .attr('opacity', 0.7);

    // Y Axis
    const yAxis = d3
      .axisLeft(yScale)
      .tickValues([0, 25, 50, 75, 100])
      .tickSize(0)
      .tickPadding(8)
      .tickFormat(d => `${d}%`);

    const yAxisGroup = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(yAxis);

    yAxisGroup.select('.domain').remove();
    yAxisGroup
      .selectAll('text')
      .attr('fill', 'currentColor')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('font-weight', '600')
      .attr('opacity', 0.65);

    // Data Points
    const pointsGroup = svg.append('g').attr('class', 'chart-points');

    chartPoints.forEach((point, idx) => {
      const cx = xScale(point.label) || margin.left;
      const cy = yScale(point.occupancyPct);
      const isLatest = idx === chartPoints.length - 1;

      // Outer ripple on latest point
      if (isLatest) {
        pointsGroup
          .append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', 8)
          .attr('fill', colorTheme.stroke)
          .attr('opacity', 0.25)
          .attr('class', 'animate-ping');
      }

      // Outer circle
      pointsGroup
        .append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', isLatest ? 5.5 : 4)
        .attr('fill', '#ffffff')
        .attr('stroke', colorTheme.stroke)
        .attr('stroke-width', isLatest ? 3 : 2)
        .attr('filter', isLatest ? 'url(#line-glow)' : 'none');

      // Value label on top of latest point
      if (isLatest) {
        pointsGroup
          .append('text')
          .attr('x', cx)
          .attr('y', cy - 10)
          .attr('text-anchor', 'middle')
          .attr('fill', colorTheme.stroke)
          .attr('font-size', '11px')
          .attr('font-weight', '800')
          .attr('font-family', 'monospace')
          .text(`${point.occupancyPct}%`);
      }
    });

    // Crosshair Guide Line (hidden by default)
    const crosshair = svg
      .append('line')
      .attr('y1', margin.top)
      .attr('y2', height - margin.bottom)
      .attr('stroke', colorTheme.stroke)
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '3,3')
      .attr('stroke-opacity', 0)
      .attr('pointer-events', 'none');

    // Hover Highlight Circle
    const hoverCircle = svg
      .append('circle')
      .attr('r', 6)
      .attr('fill', colorTheme.stroke)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2.5)
      .attr('opacity', 0)
      .attr('pointer-events', 'none');

    // Interactive Overlay Rect
    svg
      .append('rect')
      .attr('x', margin.left)
      .attr('y', margin.top)
      .attr('width', width - margin.left - margin.right)
      .attr('height', height - margin.top - margin.bottom)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', event => {
        const [mx] = d3.pointer(event);

        // Find nearest point
        let closestPoint = chartPoints[0];
        let closestDist = Infinity;

        chartPoints.forEach(p => {
          const px = xScale(p.label) || 0;
          const dist = Math.abs(px - mx);
          if (dist < closestDist) {
            closestDist = dist;
            closestPoint = p;
          }
        });

        if (closestPoint) {
          const px = xScale(closestPoint.label) || margin.left;
          const py = yScale(closestPoint.occupancyPct);

          crosshair
            .attr('x1', px)
            .attr('x2', px)
            .attr('stroke-opacity', 0.65);

          hoverCircle
            .attr('cx', px)
            .attr('cy', py)
            .attr('opacity', 1);

          setHoveredPoint({
            x: px,
            y: py,
            label: closestPoint.label,
            fullDateTime: closestPoint.fullDateTime,
            occupancyPct: closestPoint.occupancyPct,
            prevOccupancyPct: closestPoint.prevOccupancyPct,
            globalOccupancyPct: closestPoint.globalOccupancyPct,
            totalPieces: closestPoint.totalPieces,
            fileName: closestPoint.fileName
          });
        }
      })
      .on('mouseleave', () => {
        crosshair.attr('stroke-opacity', 0);
        hoverCircle.attr('opacity', 0);
        setHoveredPoint(null);
      });
  }, [chartPoints, containerWidth, activeStreet, colorTheme]);

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/95 to-slate-950/95 text-slate-100 p-4 border border-white/15 shadow-xl overflow-hidden mt-3"
    >
      {/* Background ambient glow */}
      <div
        className="absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ backgroundColor: colorTheme.stroke }}
      />

      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-base">📈</span>
            <h4 className="font-display font-extrabold text-sm sm:text-base text-white tracking-wide">
              Evolução de Ocupação — Rua {activeStreet}
            </h4>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${colorTheme.badgeClass}`}
            >
              {colorTheme.label}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Variação da taxa de ocupação da rua selecionada ao longo das últimas importações registradas no histórico
          </p>
        </div>

        {/* STREET SELECTOR & CONTROLS */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Quick Street Picker */}
          <div className="flex items-center space-x-1.5 bg-black/40 px-2.5 py-1 rounded-xl border border-white/10 text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400">Rua:</span>
            <select
              value={activeStreet}
              onChange={e => {
                const r = e.target.value;
                setActiveStreet(r);
                if (onSelectStreet) onSelectStreet(r);
              }}
              className="bg-transparent font-mono font-bold text-amber-300 focus:outline-none cursor-pointer text-xs"
            >
              {STREETS.map(r => (
                <option key={r} value={r} className="bg-slate-900 text-white">
                  Rua {r} {STREET_META[r] ? `(${STREET_META[r].badge})` : ''}
                </option>
              ))}
            </select>
          </div>

          {activeStreet !== selectedStreet && onSelectStreet && (
            <button
              type="button"
              onClick={() => {
                setActiveStreet(selectedStreet);
                onSelectStreet(selectedStreet);
              }}
              className="px-2 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 text-[10px] font-semibold transition"
              title="Voltar para a rua selecionada no mapa"
            >
              ⇄ Sincronizar ({selectedStreet})
            </button>
          )}

          {onAddSnapshot && (
            <button
              type="button"
              onClick={onAddSnapshot}
              className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-[10px] font-semibold transition flex items-center space-x-1"
              title="Registrar ponto atual no histórico"
            >
              <span>+</span>
              <span className="hidden sm:inline">Gravar Ponto</span>
            </button>
          )}

          {onResetHistory && (
            <button
              type="button"
              onClick={onResetHistory}
              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 text-[10px] transition"
              title="Restaurar histórico padrão de importações"
            >
              ↺
            </button>
          )}
        </div>
      </div>

      {/* METRIC STRIP (Current, Delta, Min, Max) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-3 border-b border-white/10">
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Ocupação Atual
          </span>
          <div className="flex items-baseline space-x-1.5 mt-0.5">
            <span
              className="font-mono text-xl font-black"
              style={{ color: colorTheme.stroke }}
            >
              {metrics.current}%
            </span>
            <span className="text-[10px] text-slate-400">da capacidade</span>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Variação no Período
          </span>
          <div className="flex items-baseline space-x-1 mt-0.5">
            <span
              className={`font-mono text-xl font-black ${
                metrics.delta > 0
                  ? 'text-rose-400'
                  : metrics.delta < 0
                  ? 'text-emerald-400'
                  : 'text-slate-300'
              }`}
            >
              {metrics.delta > 0 ? `+${metrics.delta}%` : `${metrics.delta}%`}
            </span>
            <span className="text-[10px] text-slate-400">
              {metrics.delta > 0 ? '▲ aumento' : metrics.delta < 0 ? '▼ alívio' : '— estável'}
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Faixa Histórica (Min–Max)
          </span>
          <div className="flex items-baseline space-x-1 mt-0.5">
            <span className="font-mono text-xl font-black text-amber-300">
              {metrics.min}% – {metrics.max}%
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Importações Monitoradas
          </span>
          <div className="flex items-baseline space-x-1 mt-0.5">
            <span className="font-mono text-xl font-black text-indigo-300">
              {chartPoints.length}
            </span>
            <span className="text-[10px] text-slate-400">registros</span>
          </div>
        </div>
      </div>

      {/* D3 SVG CHART CANVAS */}
      <div className="relative w-full h-[210px] pt-1">
        <svg
          ref={svgRef}
          width={containerWidth}
          height={210}
          className="w-full h-full overflow-visible select-none"
        />

        {/* FLOATING HOVER TOOLTIP */}
        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none transition-all duration-100 ease-out p-3 rounded-xl bg-slate-900/95 backdrop-blur-md border border-white/20 shadow-2xl text-xs space-y-1.5"
            style={{
              left: Math.min(Math.max(hoveredPoint.x - 100, 10), containerWidth - 220),
              top: Math.max(hoveredPoint.y - 105, 10),
              width: 210
            }}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-1">
              <span className="font-bold text-amber-300 text-[11px] truncate">
                {hoveredPoint.label}
              </span>
              <span className="text-[9px] text-slate-400 font-mono">
                {hoveredPoint.fullDateTime.split(' ')[0]}
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-0.5">
              <span className="text-[11px] text-slate-300">Rua {activeStreet}:</span>
              <span
                className="font-mono font-black text-base"
                style={{ color: colorTheme.stroke }}
              >
                {hoveredPoint.occupancyPct}%
              </span>
            </div>

            {hoveredPoint.prevOccupancyPct !== null && (
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>vs. Anterior:</span>
                <span
                  className={`font-mono font-bold ${
                    hoveredPoint.occupancyPct - hoveredPoint.prevOccupancyPct > 0
                      ? 'text-rose-400'
                      : hoveredPoint.occupancyPct - hoveredPoint.prevOccupancyPct < 0
                      ? 'text-emerald-400'
                      : 'text-slate-400'
                  }`}
                >
                  {hoveredPoint.occupancyPct - hoveredPoint.prevOccupancyPct > 0
                    ? `+${(hoveredPoint.occupancyPct - hoveredPoint.prevOccupancyPct).toFixed(1)}%`
                    : `${(hoveredPoint.occupancyPct - hoveredPoint.prevOccupancyPct).toFixed(1)}%`}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-white/10">
              <span>Ocupação Geral Armazém:</span>
              <span className="font-mono font-bold text-slate-200">
                {hoveredPoint.globalOccupancyPct}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER LEGEND & INFO */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[10px] text-slate-400 border-t border-white/10 font-mono">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: colorTheme.stroke }}
            />
            <span>Curva de Ocupação da Rua {activeStreet}</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="w-4 h-0.5 border-t border-dashed border-rose-500" />
            <span className="text-rose-400">Limite de Alerta (85%)</span>
          </div>
        </div>

        <span className="text-slate-400">
          Renderizado via D3.js v7 • Atualização Reativa WMS
        </span>
      </div>
    </div>
  );
};
export default OccupancyEvolutionChart;
