"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TERRITORY_SHAPES } from "./map-paths";

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// The SVG world dimensions (all territory paths live within this space)
const WORLD_W = 2000;
const WORLD_H = 857;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const PAN_THRESHOLD = 3;

function computeFitViewBox(containerW: number, containerH: number): ViewBox {
  if (containerW === 0 || containerH === 0) return { x: 0, y: 0, w: WORLD_W, h: WORLD_H };

  const containerAspect = containerW / containerH;
  const worldAspect = WORLD_W / WORLD_H;

  let w: number, h: number;
  if (containerAspect > worldAspect) {
    // Container is wider — match width, extend height
    w = WORLD_W;
    h = WORLD_W / containerAspect;
  } else {
    // Container is taller — match height, extend width
    h = WORLD_H;
    w = WORLD_H * containerAspect;
  }

  // Center on the world
  const x = (WORLD_W - w) / 2;
  const y = (WORLD_H - h) / 2;
  return { x, y, w, h };
}

export function useMapZoom(
  svgRef: React.RefObject<SVGSVGElement | null>,
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const [viewBox, setViewBox] = useState<ViewBox>({ x: 0, y: 0, w: WORLD_W, h: WORLD_H });
  const baseViewBox = useRef<ViewBox>({ x: 0, y: 0, w: WORLD_W, h: WORLD_H });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panStartScreen = useRef({ x: 0, y: 0 });
  const wasPanning = useRef(false);
  const lastPinchDist = useRef(0);
  const pinchMid = useRef({ x: 0, y: 0 });
  const viewBoxRef = useRef(viewBox);
  viewBoxRef.current = viewBox;

  // Measure container and set the base (zoom=1) viewBox
  const hasInitialized = useRef(false);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const rect = container.getBoundingClientRect();
      const newBase = computeFitViewBox(rect.width, rect.height);
      baseViewBox.current = newBase;

      if (!hasInitialized.current) {
        // First mount: set initial zoom level
        hasInitialized.current = true;
        const aspect = newBase.w / newBase.h;
        const w = newBase.w / MIN_ZOOM;
        const h = w / aspect;
        const cx = newBase.x + newBase.w / 2;
        const cy = newBase.y + newBase.h / 2;
        setViewBox({ x: cx - w / 2, y: cy - h / 2, w, h });
      }
      // Subsequent resizes: only update baseViewBox for clamping.
      // Do NOT touch the viewBox — preserves user's zoom/pan position.
    };

    const ro = new ResizeObserver(update);
    ro.observe(container);
    update();
    return () => ro.disconnect();
  }, [containerRef]);

  const zoomLevel = baseViewBox.current.w / viewBox.w;

  function clampViewBox(vb: ViewBox): ViewBox {
    const base = baseViewBox.current;
    const aspect = base.w / base.h;
    const maxW = base.w / MIN_ZOOM;
    const w = Math.max(base.w / MAX_ZOOM, Math.min(maxW, vb.w));
    const h = w / aspect;
    // Allow panning across extended world + ocean margins
    const minX = Math.min(base.x, 0);
    const minY = Math.min(base.y, 0);
    const maxX = Math.max(WORLD_W - w, base.x);
    const maxY = Math.max(WORLD_H - h, base.y);
    const x = Math.max(minX, Math.min(maxX, vb.x));
    const y = Math.max(minY, Math.min(maxY, vb.y));
    return { x, y, w, h };
  }

  function screenToSVG(screenX: number, screenY: number): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = screenX;
    pt.y = screenY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }

  // Wheel zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const mouse = screenToSVG(e.clientX, e.clientY);
      if (!mouse) return;

      const vb = viewBoxRef.current;
      const base = baseViewBox.current;
      const factor = e.deltaY < 0 ? 0.9 : 1.1;
      const aspect = base.w / base.h;

      const newW = Math.max(base.w / MAX_ZOOM, Math.min(base.w / MIN_ZOOM, vb.w * factor));
      const newH = newW / aspect;

      if (newW === vb.w) return;

      const newX = mouse.x - (mouse.x - vb.x) * (newW / vb.w);
      const newY = mouse.y - (mouse.y - vb.y) * (newH / vb.h);

      setViewBox(clampViewBox({ x: newX, y: newY, w: newW, h: newH }));
    };

    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, [svgRef]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    wasPanning.current = false;
    panStartScreen.current = { x: e.clientX, y: e.clientY };
    const svgPt = screenToSVG(e.clientX, e.clientY);
    if (svgPt) panStart.current = svgPt;
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;

    const dx = e.clientX - panStartScreen.current.x;
    const dy = e.clientY - panStartScreen.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > PAN_THRESHOLD) {
      wasPanning.current = true;
    }

    const current = screenToSVG(e.clientX, e.clientY);
    if (!current) return;

    const vb = viewBoxRef.current;
    setViewBox(clampViewBox({
      x: vb.x + (panStart.current.x - current.x),
      y: vb.y + (panStart.current.y - current.y),
      w: vb.w,
      h: vb.h,
    }));
  }, []);

  const onMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const onMouseLeave = useCallback(() => {
    isPanning.current = false;
  }, []);

  const resetZoom = useCallback(() => {
    const base = baseViewBox.current;
    const aspect = base.w / base.h;
    const w = base.w / MIN_ZOOM;
    const h = w / aspect;
    const cx = base.x + base.w / 2;
    const cy = base.y + base.h / 2;
    setViewBox({ x: cx - w / 2, y: cy - h / 2, w, h });
  }, []);

  const focusOn = useCallback((territoryIds: string[]) => {
    const shapes = TERRITORY_SHAPES.filter((s) => territoryIds.includes(s.id));
    if (shapes.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of shapes) {
      minX = Math.min(minX, s.bbox.x);
      minY = Math.min(minY, s.bbox.y);
      maxX = Math.max(maxX, s.bbox.x + s.bbox.w);
      maxY = Math.max(maxY, s.bbox.y + s.bbox.h);
    }

    // Add 30% padding
    const padX = (maxX - minX) * 0.3;
    const padY = (maxY - minY) * 0.3;
    const base = baseViewBox.current;
    const aspect = base.w / base.h;

    let w = (maxX - minX) + padX * 2;
    let h = (maxY - minY) + padY * 2;

    // Maintain aspect ratio
    if (w / h > aspect) {
      h = w / aspect;
    } else {
      w = h * aspect;
    }

    // Ensure minimum zoom (don't zoom in too far)
    w = Math.max(w, base.w / MAX_ZOOM);
    h = w / aspect;

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    setViewBox(clampViewBox({ x: cx - w / 2, y: cy - h / 2, w, h }));
  }, []);

  return {
    viewBox,
    zoomLevel,
    wasPanning,
    resetZoom,
    focusOn,
    handlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave,
    },
  };
}
