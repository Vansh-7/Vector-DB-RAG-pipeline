import { useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3';
import type { VectorPoint2D, Category } from '../types';
import { CATEGORY_COLORS } from '../types/vector';
import { useCanvasStore } from '../store/canvasStore';

interface TooltipState {
  id: string;
  category: Category;
  x: number;
  y: number;
  payload?: string;
  distance?: number;
}

interface UseVectorCanvasReturn {
  svgRef: React.RefObject<SVGSVGElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  tooltip: TooltipState | null;
  zoomLevel: number;
  resetZoom: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

function computeFitTransform(
  vectors: VectorPoint2D[],
  width: number,
  height: number
): d3.ZoomTransform {
  if (vectors.length === 0) {
    return d3.zoomIdentity.translate(width / 2, height / 2).scale(30);
  }

  const xVals = vectors.map((v) => v.x);
  const yVals = vectors.map((v) => v.y);
  const xMin = Math.min(...xVals);
  const xMax = Math.max(...xVals);
  const yMin = Math.min(...yVals);
  const yMax = Math.max(...yVals);

  const dataWidth = xMax - xMin || 1;
  const dataHeight = yMax - yMin || 1;
  const cx = (xMin + xMax) / 2;
  const cy = (yMin + yMax) / 2;

  const padding = 1.3;
  const scale = Math.min(
    width / (dataWidth * padding),
    height / (dataHeight * padding)
  );

  return d3.zoomIdentity
    .translate(width / 2 - cx * scale, height / 2 - cy * scale)
    .scale(scale);
}

export function useVectorCanvas(
  vectors: VectorPoint2D[],
  hiddenCategories: Set<Category>
): UseVectorCanvasReturn {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const baseScaleRef = useRef(1);
  const initialScaleRef = useRef(0);
  const hasFittedRef = useRef(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const highlightedIds = useCanvasStore((s) => s.highlightedIds);
  const highlightedScores = useCanvasStore((s) => s.highlightedScores);
  const queryPoint = useCanvasStore((s) => s.queryPoint);
  const setHighlighted = useCanvasStore((s) => s.setHighlighted);

  const visibleVectors = vectors.filter((v) => !hiddenCategories.has(v.category));

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const d3Svg = d3.select(svg);

    let g = d3Svg.select<SVGGElement>('g.canvas-root');
    if (g.empty()) {
      g = d3Svg.append('g').attr('class', 'canvas-root');
      g.append('g').attr('class', 'edges-layer');
      g.append('g').attr('class', 'points-layer');
      g.append('g').attr('class', 'hover-layer');
    }
    gRef.current = g.node();

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 500])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString());
        baseScaleRef.current = event.transform.k;
        if (initialScaleRef.current === 0) initialScaleRef.current = event.transform.k;
        setZoomLevel(event.transform.k / initialScaleRef.current);

        // Keep visual size constant
        g.selectAll('.data-point')
          .attr('r', 4 / event.transform.k)
          .attr('stroke-width', 4 / event.transform.k);
        g.selectAll('.active-ring').attr('r', 8 / event.transform.k).attr('stroke-width', 1.5 / event.transform.k);
      });

    d3Svg.call(zoom);
    zoomRef.current = zoom;

    // Clear selection if clicking on empty canvas space
    d3Svg.on('click.bg', (event) => {
      const target = event.target as Element;
      if (!target.classList || !target.classList.contains('data-point')) {
        setTooltip(null);
        if (!g.select('.active-ring').empty()) {
          const currentK = baseScaleRef.current || 1;
          g.selectAll('.active-ring')
            .interrupt()
            .transition().duration(100).ease(d3.easeCubicOut)
            .attr('opacity', 0).attr('r', 6 / currentK).remove();
        }
        g.selectAll('.data-point')
          .interrupt()
          .transition().duration(100)
          .attr('opacity', 0.85)
          .attr('filter', 'url(#glow-dim)');
      }
    });

    return () => {
      d3Svg.on('.zoom', null);
      d3Svg.on('.bg', null);
    };
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    const zoom = zoomRef.current;
    if (!svg || !zoom || vectors.length === 0 || hasFittedRef.current) return;

    const { width, height } = svg.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    const fitTransform = computeFitTransform(vectors, width, height);
    baseScaleRef.current = fitTransform.k;
    if (initialScaleRef.current === 0) initialScaleRef.current = fitTransform.k;
    hasFittedRef.current = true;

    d3.select(svg).call(zoom.transform, fitTransform);
  }, [vectors]);

  useEffect(() => {
    const g = gRef.current;
    if (!g) return;

    const pointsLayer = d3.select(g).select<SVGGElement>('g.points-layer');
    const baseScale = baseScaleRef.current || 30;
    const hitAreaStrokeW = 4 / baseScale;

    const circles = pointsLayer
      .selectAll<SVGCircleElement, VectorPoint2D>('.data-point')
      .data(visibleVectors, (d) => d.id);

    circles.exit().transition().duration(200).attr('r', 4 / (baseScaleRef.current || 30)).attr('opacity', 0).remove();

    const entered = circles
      .enter()
      .append('circle')
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y)
      .attr('r', 4 / (baseScaleRef.current || 30))
      .attr('opacity', 0)
      .attr('class', 'data-point')
      .attr('fill', (d) => CATEGORY_COLORS[d.category])
      .attr('cursor', 'pointer')
      .attr('stroke', 'transparent')
      .attr('stroke-width', hitAreaStrokeW)
      .on('click', function (event: MouseEvent, d) {
        event.stopPropagation(); // prevent click.bg from firing

        // Bring clicked point to front
        d3.select(this).raise();

        const currentK = baseScaleRef.current || 1;

        // Smoothly fade out any existing active rings
        pointsLayer.selectAll('.active-ring')
          .interrupt()
          .transition()
          .duration(150)
          .ease(d3.easeCubicOut)
          .attr('opacity', 0)
          .attr('r', 6 / currentK)
          .remove();

        // Ensure all other points are in their normal non-dimmed state
        pointsLayer.selectAll('.data-point')
          .interrupt()
          .attr('opacity', 0.85)
          .attr('filter', 'url(#glow-dim)');

        // Smoothly glow the clicked point
        d3.select(this)
          .interrupt()
          .transition()
          .duration(100)
          .ease(d3.easeCubicOut)
          .attr('opacity', 1)
          .attr('filter', 'url(#glow-bright)');

        // Append a new active ring
        pointsLayer.append('circle')
          .attr('class', 'active-ring pointer-events-none')
          .attr('cx', d.x)
          .attr('cy', d.y)
          .attr('r', 4 / currentK) // Start smaller
          .attr('fill', 'none')
          .attr('stroke', CATEGORY_COLORS[d.category])
          .attr('stroke-width', 2 / currentK)
          .attr('opacity', 0) // Start transparent
          .transition()
          .duration(200)
          .ease(d3.easeBackOut.overshoot(1.2)) // Beautiful spring-like pop
          .attr('r', 10 / currentK)
          .attr('opacity', 0.8);

        const container = containerRef.current;
        const rect = container?.getBoundingClientRect();
        setTooltip({
          id: d.id,
          category: d.category,
          x: event.clientX - (rect?.left ?? 0),
          y: event.clientY - (rect?.top ?? 0),
          payload: d.payload,
          distance: highlightedScores[d.id],
        });

        setHighlighted([d.id]);
      });

    entered
      .transition()
      .duration(400)
      .ease(d3.easeCubicOut)
      .attr('r', 4 / (baseScaleRef.current || 30))
      .attr('opacity', 0.85)
      .attr('filter', 'url(#glow-dim)');

    circles
      .transition()
      .duration(300)
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y)
      .attr('fill', (d) => CATEGORY_COLORS[d.category])
      .attr('opacity', 0.85)
      .attr('filter', 'url(#glow-dim)');
  }, [visibleVectors, highlightedScores, setHighlighted]);

  useEffect(() => {
    const g = gRef.current;
    if (!g) return;

    const edgesLayer = d3.select(g).select<SVGGElement>('g.edges-layer');
    edgesLayer.selectAll('*').remove();

    if (!queryPoint || highlightedIds.length === 0) return;

    const baseScale = baseScaleRef.current || 30;
    const strokeW = 1.5 / baseScale;
    const dashLen = 4 / baseScale;
    const highlighted = visibleVectors.filter((v) => highlightedIds.includes(v.id));

    for (const target of highlighted) {
      edgesLayer
        .append('line')
        .attr('x1', queryPoint.x)
        .attr('y1', queryPoint.y)
        .attr('x2', target.x)
        .attr('y2', target.y)
        .attr('stroke', CATEGORY_COLORS[target.category])
        .attr('stroke-width', strokeW)
        .attr('stroke-dasharray', `${dashLen},${dashLen}`)
        .attr('opacity', 0.5);
    }

    edgesLayer
      .append('circle')
      .attr('cx', queryPoint.x)
      .attr('cy', queryPoint.y)
      .attr('r', 5 / baseScale)
      .attr('fill', 'none')
      .attr('stroke', '#fff')
      .attr('stroke-width', strokeW)
      .attr('stroke-dasharray', `${dashLen * 0.8},${dashLen * 0.8}`);
  }, [queryPoint, highlightedIds, visibleVectors]);

  const resetZoom = useCallback(() => {
    const svg = svgRef.current;
    const zoom = zoomRef.current;
    if (!svg || !zoom) return;

    const { width, height } = svg.getBoundingClientRect();
    const fitTransform = computeFitTransform(vectors, width, height);
    d3.select(svg)
      .transition()
      .duration(500)
      .call(zoom.transform, fitTransform);
  }, [vectors]);

  const zoomIn = useCallback(() => {
    const svg = svgRef.current;
    const zoom = zoomRef.current;
    if (!svg || !zoom) return;
    d3.select(svg).transition().duration(300).call(zoom.scaleBy, 1.5);
  }, []);

  const zoomOut = useCallback(() => {
    const svg = svgRef.current;
    const zoom = zoomRef.current;
    if (!svg || !zoom) return;
    d3.select(svg).transition().duration(300).call(zoom.scaleBy, 1 / 1.5);
  }, []);

  return { svgRef, containerRef, tooltip, zoomLevel, resetZoom, zoomIn, zoomOut };
}
