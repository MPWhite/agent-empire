#!/usr/bin/env node
/**
 * Generate map-paths.ts from the simplemaps SVG world map data.
 * Maps game territory IDs to ISO country codes in the SVG.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgData = JSON.parse(readFileSync(join(__dirname, '../src/lib/svg-country-data.json'), 'utf8'));

// Game territory ID → SVG ISO code mapping
const TERRITORY_TO_ISO = {
  // North America
  canada: 'CA',
  united_states_of_america: 'US',
  greenland: 'GL',
  mexico: 'MX',
  cuba: 'CU',

  // Central America
  panama: 'PA',
  costa_rica: 'CR',
  nicaragua: 'NI',
  honduras: 'HN',
  el_salvador: 'SV',
  guatemala: 'GT',
  belize: 'BZ',

  // South America
  argentina: 'AR',
  chile: 'CL',
  uruguay: 'UY',
  brazil: 'BR',
  bolivia: 'BO',
  peru: 'PE',
  colombia: 'CO',
  venezuela: 'VE',
  guyana: 'GY',
  suriname: 'SR',
  ecuador: 'EC',
  paraguay: 'PY',

  // Western Europe
  france: 'FR',
  germany: 'DE',
  belgium: 'BE',
  netherlands: 'NL',
  portugal: 'PT',
  spain: 'ES',
  ireland: 'IE',
  italy: 'IT',
  denmark: 'DK',
  united_kingdom: 'GB',
  iceland: 'IS',

  // Northern Europe
  norway: 'NO',
  sweden: 'SE',
  lithuania: 'LT',
  latvia: 'LV',
  estonia: 'EE',
  finland: 'FI',

  // Eastern Europe
  poland: 'PL',
  austria: 'AT',
  hungary: 'HU',
  romania: 'RO',
  bulgaria: 'BG',
  greece: 'GR',
  albania: 'AL',
  switzerland: 'CH',
  slovakia: 'SK',
  czechia: 'CZ',
  bosnia_and_herz: 'BA',

  // Former Soviet
  russia: 'RU',
  armenia: 'AM',
  belarus: 'BY',
  ukraine: 'UA',
  moldova: 'MD',
  turkey: 'TR',
  croatia: 'HR',
  azerbaijan: 'AZ',
  georgia: 'GE',
  slovenia: 'SI',
  macedonia: 'MK',
  serbia: 'RS',
  montenegro: 'ME',

  // Middle East
  jordan: 'JO',
  united_arab_emirates: 'AE',
  iraq: 'IQ',
  oman: 'OM',
  iran: 'IR',
  syria: 'SY',
  yemen: 'YE',
  saudi_arabia: 'SA',

  // North Africa
  w_sahara: 'EH',
  mauritania: 'MR',
  tunisia: 'TN',
  algeria: 'DZ',
  morocco: 'MA',
  egypt: 'EG',
  libya: 'LY',

  // West Africa
  senegal: 'SN',
  mali: 'ML',
  benin: 'BJ',
  niger: 'NE',
  nigeria: 'NG',
  togo: 'TG',
  ghana: 'GH',
  cte_divoire: 'CI',
  guinea: 'GN',
  liberia: 'LR',
  sierra_leone: 'SL',
  burkina_faso: 'BF',

  // East Africa
  tanzania: 'TZ',
  somalia: 'SO',
  kenya: 'KE',
  sudan: 'SD',
  zimbabwe: 'ZW',
  zambia: 'ZM',
  malawi: 'MW',
  mozambique: 'MZ',
  burundi: 'BI',
  madagascar: 'MG',
  eritrea: 'ER',
  ethiopia: 'ET',
  uganda: 'UG',
  rwanda: 'RW',
  s_sudan: 'SS',

  // Central Africa
  dem_rep_congo: 'CD',
  chad: 'TD',
  south_africa: 'ZA',
  botswana: 'BW',
  namibia: 'NA',
  cameroon: 'CM',
  central_african_rep: 'CF',
  congo: 'CG',
  gabon: 'GA',
  eq_guinea: 'GQ',
  angola: 'AO',

  // Central Asia
  kazakhstan: 'KZ',
  uzbekistan: 'UZ',
  mongolia: 'MN',
  afghanistan: 'AF',
  tajikistan: 'TJ',
  kyrgyzstan: 'KG',
  turkmenistan: 'TM',

  // South Asia
  india: 'IN',
  bangladesh: 'BD',
  nepal: 'NP',
  pakistan: 'PK',
  sri_lanka: 'LK',

  // East Asia
  north_korea: 'KP',
  south_korea: 'KR',
  china: 'CN',
  taiwan: 'TW',
  japan: 'JP',

  // Southeast Asia
  indonesia: 'ID',
  cambodia: 'KH',
  thailand: 'TH',
  laos: 'LA',
  myanmar: 'MM',
  vietnam: 'VN',
  philippines: 'PH',
  malaysia: 'MY',

  // Oceania
  papua_new_guinea: 'PG',
  new_zealand: 'NZ',
  australia: 'AU',
};

/**
 * Parse an SVG path string and compute its bounding box centroid.
 * Handles M, L, l, m, z, h, H, v, V, c, C, s, S, q, Q, t, T, a, A commands.
 */
function computeCentroid(pathStrings) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const d of pathStrings) {
    // Tokenize: split into commands and numbers
    const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
    if (!tokens) continue;

    let cx = 0, cy = 0; // current point
    let i = 0;

    function nextNum() {
      while (i < tokens.length && /^[a-zA-Z]$/.test(tokens[i])) i++;
      return i < tokens.length ? parseFloat(tokens[i++]) : 0;
    }

    function updateBounds(x, y) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    while (i < tokens.length) {
      const cmd = tokens[i];
      if (/^[a-zA-Z]$/.test(cmd)) {
        i++;
        switch (cmd) {
          case 'M': cx = nextNum(); cy = nextNum(); updateBounds(cx, cy);
            // Implicit lineTo after M
            while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
              cx = nextNum(); cy = nextNum(); updateBounds(cx, cy);
            }
            break;
          case 'm': cx += nextNum(); cy += nextNum(); updateBounds(cx, cy);
            while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
              cx += nextNum(); cy += nextNum(); updateBounds(cx, cy);
            }
            break;
          case 'L':
            while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
              cx = nextNum(); cy = nextNum(); updateBounds(cx, cy);
            }
            break;
          case 'l':
            while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
              cx += nextNum(); cy += nextNum(); updateBounds(cx, cy);
            }
            break;
          case 'H': cx = nextNum(); updateBounds(cx, cy); break;
          case 'h': cx += nextNum(); updateBounds(cx, cy); break;
          case 'V': cy = nextNum(); updateBounds(cx, cy); break;
          case 'v': cy += nextNum(); updateBounds(cx, cy); break;
          case 'C':
            while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
              nextNum(); nextNum(); nextNum(); nextNum();
              cx = nextNum(); cy = nextNum(); updateBounds(cx, cy);
            }
            break;
          case 'c':
            while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
              nextNum(); nextNum(); nextNum(); nextNum();
              const dx = nextNum(); const dy = nextNum();
              cx += dx; cy += dy; updateBounds(cx, cy);
            }
            break;
          case 'S':
            while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
              nextNum(); nextNum();
              cx = nextNum(); cy = nextNum(); updateBounds(cx, cy);
            }
            break;
          case 's':
            while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
              nextNum(); nextNum();
              const sdx = nextNum(); const sdy = nextNum();
              cx += sdx; cy += sdy; updateBounds(cx, cy);
            }
            break;
          case 'Q':
            while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
              nextNum(); nextNum();
              cx = nextNum(); cy = nextNum(); updateBounds(cx, cy);
            }
            break;
          case 'q':
            while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
              nextNum(); nextNum();
              const qdx = nextNum(); const qdy = nextNum();
              cx += qdx; cy += qdy; updateBounds(cx, cy);
            }
            break;
          case 'T':
            while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
              cx = nextNum(); cy = nextNum(); updateBounds(cx, cy);
            }
            break;
          case 't':
            while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
              cx += nextNum(); cy += nextNum(); updateBounds(cx, cy);
            }
            break;
          case 'A':
            while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
              nextNum(); nextNum(); nextNum(); nextNum(); nextNum();
              cx = nextNum(); cy = nextNum(); updateBounds(cx, cy);
            }
            break;
          case 'a':
            while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
              nextNum(); nextNum(); nextNum(); nextNum(); nextNum();
              const adx = nextNum(); const ady = nextNum();
              cx += adx; cy += ady; updateBounds(cx, cy);
            }
            break;
          case 'Z': case 'z': break;
          default: break;
        }
      } else {
        i++;
      }
    }
  }

  return {
    cx: Math.round((minX + maxX) / 2),
    cy: Math.round((minY + maxY) / 2),
  };
}

// Some countries need label positioning overrides (centroid falls in water or off-territory)
const CENTROID_OVERRIDES = {
  // Russia: center on European part, not geometric center across all of Siberia
  russia: { cx: 1350, cy: 170 },
  // USA: center on continental US, not between Alaska and Hawaii
  united_states_of_america: { cx: 430, cy: 280 },
  // France: continental France, not between France and French Guiana
  france: { cx: 1020, cy: 215 },
  // Malaysia: peninsula part
  malaysia: { cx: 1570, cy: 457 },
  // Indonesia: Java area
  indonesia: { cx: 1620, cy: 510 },
  // Canada: southern populated area
  canada: { cx: 400, cy: 195 },
  // Chile: central Chile
  chile: { cx: 610, cy: 700 },
  // New Zealand: North Island
  new_zealand: { cx: 1880, cy: 730 },
  // Japan: Honshu
  japan: { cx: 1720, cy: 280 },
  // Norway: southern part
  norway: { cx: 1050, cy: 145 },
  // Greece: mainland
  greece: { cx: 1110, cy: 255 },
  // Philippines: central
  philippines: { cx: 1650, cy: 415 },
};

// Build the territory shapes
const shapes = [];
const missing = [];

for (const [territoryId, isoCode] of Object.entries(TERRITORY_TO_ISO)) {
  const country = svgData.countries[isoCode];
  if (!country) {
    missing.push({ territoryId, isoCode });
    continue;
  }

  // Combine all paths into a single path string
  const combinedPath = country.paths.join(' ');

  // Compute centroid from bounding box
  const centroid = CENTROID_OVERRIDES[territoryId] || computeCentroid(country.paths);

  shapes.push({
    id: territoryId,
    path: combinedPath,
    cx: centroid.cx,
    cy: centroid.cy,
  });
}

if (missing.length > 0) {
  console.error('Missing countries in SVG data:');
  for (const m of missing) {
    console.error(`  ${m.territoryId} (${m.isoCode})`);
  }
}

// Generate the TypeScript file
const continentColors = `export const CONTINENT_COLORS: Record<string, string> = {
  north_america: '#2d6a4f',
  central_america: '#40916c',
  south_america: '#b8860b',
  western_europe: '#4a6fa5',
  northern_europe: '#5b8fb9',
  eastern_europe: '#3d5a80',
  former_soviet: '#6b4c3b',
  middle_east: '#c47f17',
  north_africa: '#a67c52',
  west_africa: '#8b6914',
  east_africa: '#7a5c2e',
  central_africa: '#6b5b3e',
  central_asia: '#5c4033',
  south_asia: '#7b5ea7',
  east_asia: '#8b4513',
  southeast_asia: '#6b8e23',
  oceania: '#7b5ea7',
};`;

const shapesStr = shapes.map(s => {
  return `  { id: '${s.id}', path: '${s.path}', cx: ${s.cx}, cy: ${s.cy} },`;
}).join('\n');

const output = `// Auto-generated from simplemaps.com Free Blank World Map SVG (MIT License)
// viewBox: 0 0 2000 857

export interface TerritoryShape {
  id: string;
  path: string;
  cx: number;
  cy: number;
}

export const TERRITORY_SHAPES: TerritoryShape[] = [
${shapesStr}
];

${continentColors}

export const SEA_PATHS: Record<string, string> = {};
`;

writeFileSync(join(__dirname, '../src/lib/map-paths.ts'), output);
console.log(`Generated map-paths.ts with ${shapes.length} territories`);
console.log(`ViewBox: 0 0 2000 857`);
