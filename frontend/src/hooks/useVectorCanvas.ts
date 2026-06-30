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
}

interface UseVectorCanvasReturn {
  svgRef: React.RefObject<SVGSVGElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  tooltip: TooltipState | null;
  zoomLevel: number;
  resetZoom: () => void;
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
  const hasFittedRef = useRef(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const highlightedIds = useCanvasStore((s) => s.highlightedIds);
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
    }
    gRef.current = g.node();

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 500])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString());
        const base = baseScaleRef.current || 1;
        setZoomLevel(event.transform.k / base);
      });

    d3Svg.call(zoom);
    zoomRef.current = zoom;

    return () => {
      d3Svg.on('.zoom', null);
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
    hasFittedRef.current = true;

    d3.select(svg).call(zoom.transform, fitTransform);
  }, [vectors]);

  useEffect(() => {
    const g = gRef.current;
    if (!g) return;

    const pointsLayer = d3.select(g).select<SVGGElement>('g.points-layer');
    const baseScale = baseScaleRef.current || 30;
    const r = Math.max(3 / baseScale, 0.08);
    const rHover = r * 1.6;

    const circles = pointsLayer
      .selectAll<SVGCircleElement, VectorPoint2D>('circle')
      .data(visibleVectors, (d) => d.id);

    circles.exit().transition().duration(200).attr('r', 0).attr('opacity', 0).remove();

    const entered = circles
      .enter()
      .append('circle')
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y)
      .attr('r', 0)
      .attr('opacity', 0)
      .attr('fill', (d) => CATEGORY_COLORS[d.category])
      .attr('cursor', 'pointer')
      .on('mouseenter', function (event: MouseEvent, d) {
        d3.select(this).transition().duration(100).attr('r', rHover);
        const container = containerRef.current;
        const rect = container?.getBoundingClientRect();
        setTooltip({
          id: d.id,
          category: d.category,
          x: event.clientX - (rect?.left ?? 0),
          y: event.clientY - (rect?.top ?? 0),
          payload: d.payload,
        });
      })
      .on('mousemove', function (event: MouseEvent, d) {
        const container = containerRef.current;
        const rect = container?.getBoundingClientRect();
        setTooltip({
          id: d.id,
          category: d.category,
          x: event.clientX - (rect?.left ?? 0),
          y: event.clientY - (rect?.top ?? 0),
          payload: d.payload,
        });
      })
      .on('mouseleave', function () {
        d3.select(this).transition().duration(100).attr('r', r);
        setTooltip(null);
      })
      .on('click', function (_event: MouseEvent, d) {
        setHighlighted([d.id]);
      });

    entered
      .transition()
      .duration(400)
      .ease(d3.easeCubicOut)
      .attr('r', r)
      .attr('opacity', 0.85);

    circles
      .transition()
      .duration(300)
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y)
      .attr('fill', (d) => CATEGORY_COLORS[d.category])
      .attr('opacity', (d) =>
        highlightedIds.length > 0
          ? highlightedIds.includes(d.id)
            ? 1
            : 0.2
          : 0.85
      );
  }, [visibleVectors, highlightedIds, setHighlighted]);

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

  return { svgRef, containerRef, tooltip, zoomLevel, resetZoom };
}
