// SVG path data and center coordinates for each territory
// Arranged in a roughly geographic layout

export interface TerritoryShape {
  id: string;
  path: string;
  cx: number; // center x for label
  cy: number; // center y for label
}

// Canvas is 1000x700
export const TERRITORY_SHAPES: TerritoryShape[] = [
  // ── Northlands (top area, y: 20-180) ──
  { id: 'n1', path: 'M 80,30 L 160,25 L 180,80 L 140,110 L 60,100 Z', cx: 120, cy: 65 },
  { id: 'n2', path: 'M 180,25 L 280,20 L 300,70 L 270,110 L 180,80 Z', cx: 235, cy: 60 },
  { id: 'n3', path: 'M 160,100 L 270,110 L 280,170 L 200,180 L 140,150 Z', cx: 210, cy: 140 },
  { id: 'n4', path: 'M 300,20 L 400,30 L 410,90 L 370,120 L 300,70 Z', cx: 355, cy: 65 },
  { id: 'n5', path: 'M 280,120 L 370,120 L 390,180 L 320,190 L 280,170 Z', cx: 330, cy: 155 },
  { id: 'n6', path: 'M 410,90 L 490,60 L 510,130 L 460,170 L 390,150 Z', cx: 450, cy: 115 },

  // ── Midlands (center area, y: 200-400) ──
  { id: 'm1', path: 'M 200,200 L 300,195 L 320,250 L 280,280 L 190,270 Z', cx: 255, cy: 235 },
  { id: 'm2', path: 'M 120,230 L 190,220 L 200,280 L 170,320 L 100,300 Z', cx: 155, cy: 270 },
  { id: 'm3', path: 'M 300,280 L 400,270 L 420,330 L 380,360 L 290,350 Z', cx: 355, cy: 315 },
  { id: 'm4', path: 'M 100,310 L 170,320 L 180,380 L 140,400 L 80,380 Z', cx: 135, cy: 355 },
  { id: 'm5', path: 'M 200,290 L 290,285 L 300,350 L 260,380 L 190,360 Z', cx: 245, cy: 330 },
  { id: 'm6', path: 'M 380,360 L 470,345 L 490,410 L 450,440 L 370,420 Z', cx: 430, cy: 390 },
  { id: 'm7', path: 'M 180,390 L 260,380 L 280,440 L 240,470 L 170,450 Z', cx: 225, cy: 425 },
  { id: 'm8', path: 'M 290,390 L 370,380 L 390,440 L 350,470 L 280,450 Z', cx: 335, cy: 425 },

  // ── Desert Wastes (right area, y: 280-480) ──
  { id: 'd1', path: 'M 600,280 L 700,270 L 720,330 L 680,360 L 590,350 Z', cx: 655, cy: 315 },
  { id: 'd2', path: 'M 700,270 L 800,280 L 810,340 L 770,370 L 720,330 Z', cx: 755, cy: 320 },
  { id: 'd3', path: 'M 590,360 L 680,360 L 700,420 L 650,450 L 580,430 Z', cx: 640, cy: 405 },
  { id: 'd4', path: 'M 770,370 L 860,360 L 880,430 L 840,460 L 760,440 Z', cx: 820, cy: 410 },
  { id: 'd5', path: 'M 650,450 L 760,440 L 780,510 L 720,540 L 640,520 Z', cx: 710, cy: 485 },

  // ── Iron Islands (left area, y: 300-480) ──
  { id: 'i1', path: 'M 20,300 L 80,290 L 100,340 L 70,370 L 15,355 Z', cx: 55, cy: 330 },
  { id: 'i2', path: 'M 30,380 L 90,375 L 100,430 L 70,455 L 25,440 Z', cx: 60, cy: 415 },
  { id: 'i3', path: 'M 15,470 L 80,460 L 100,520 L 65,545 L 10,530 Z', cx: 55, cy: 500 },
  { id: 'i4', path: 'M 90,440 L 140,435 L 150,490 L 120,515 L 80,500 Z', cx: 115, cy: 475 },

  // ── Southlands (bottom area, y: 480-670) ──
  { id: 's1', path: 'M 350,480 L 440,470 L 460,530 L 420,560 L 340,545 Z', cx: 400, cy: 515 },
  { id: 's2', path: 'M 220,500 L 310,490 L 330,550 L 290,580 L 210,565 Z', cx: 270, cy: 535 },
  { id: 's3', path: 'M 340,555 L 430,545 L 450,610 L 410,640 L 330,620 Z', cx: 390, cy: 590 },
  { id: 's4', path: 'M 230,580 L 330,570 L 350,630 L 310,660 L 220,645 Z', cx: 285, cy: 615 },
  { id: 's5', path: 'M 440,610 L 540,600 L 560,660 L 520,685 L 430,670 Z', cx: 495, cy: 645 },
  { id: 's6', path: 'M 330,650 L 430,640 L 450,690 L 400,710 L 320,700 Z', cx: 385, cy: 675 },
  { id: 's7', path: 'M 520,660 L 620,650 L 640,710 L 590,730 L 510,720 Z', cx: 575, cy: 690 },
];

// Continent colors for subtle background tinting
export const CONTINENT_COLORS: Record<string, string> = {
  northlands: 'rgba(147, 197, 253, 0.08)', // blue tint
  midlands: 'rgba(167, 243, 208, 0.08)',   // green tint
  desert: 'rgba(253, 224, 71, 0.08)',      // yellow tint
  islands: 'rgba(196, 181, 253, 0.08)',    // purple tint
  southlands: 'rgba(252, 165, 165, 0.08)', // red tint
};
