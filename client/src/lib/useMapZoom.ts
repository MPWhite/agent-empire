"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const INITIAL_W = 2000;
const INITIAL_H = 857;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const PAN_THRESHOLD = 3; // px screen distance to distinguish click from pan

export function useMapZoom(svgRef: React.RefObject<SVGSVGElement | null>) {
  const [viewBox, setViewBox] = useState<ViewBox>({ x: 0, y: 0, w: INITIAL_W, h: INITIAL_H });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 }); // SVG coords at drag start
  const panStartScreen = useRef({ x: 0, y: 0 }); // screen coords at drag start
  const wasPanning = useRef(false);
  const viewBoxRef = useRef(viewBox);
  viewBoxRef.current = viewBox;

  const zoomLevel = INITIAL_W / viewBox.w;

  function clampViewBox(vb: ViewBox): ViewBox {
    const w = Math.max(INITIAL_W / MAX_ZOOM, Math.min(INITIAL_W / MIN_ZOOM, vb.w));
    const h = w * (INITIAL_H / INITIAL_W);
    const x = Math.max(0, Math.min(INITIAL_W - w, vb.x));
    const y = Math.max(0, Math.min(INITIAL_H - h, vb.y));
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

  // Wheel zoom — must use native listener with { passive: false }
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const mouse = screenToSVG(e.clientX, e.clientY);
      if (!mouse) return;

      const vb = viewBoxRef.current;
      const factor = e.deltaY < 0 ? 0.9 : 1.1; // scroll up = zoom in

      // Clamp width/height BEFORE computing position to avoid drift at zoom limits
      const newW = Math.max(INITIAL_W / MAX_ZOOM, Math.min(INITIAL_W / MIN_ZOOM, vb.w * factor));
      const newH = newW * (INITIAL_H / INITIAL_W);

      // If size didn't change (at zoom limit), skip
      if (newW === vb.w) return;

      // Zoom toward cursor
      const newX = mouse.x - (mouse.x - vb.x) * (newW / vb.w);
      const newY = mouse.y - (mouse.y - vb.y) * (newH / vb.h);

      setViewBox(clampViewBox({ x: newX, y: newY, w: newW, h: newH }));
    };

    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, [svgRef]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // left button only
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
    setViewBox({ x: 0, y: 0, w: INITIAL_W, h: INITIAL_H });
  }, []);

  return {
    viewBox,
    zoomLevel,
    wasPanning,
    resetZoom,
    handlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave,
    },
  };
}
