// Hex grid utilities — flat-top hexagons, offset coordinates (odd-q)
// Reference: https://www.redblobgames.com/grids/hexagons/

export type HexCoord = { q: number; r: number };

export const GRID_COLS = 10;
export const GRID_ROWS = 10;
export const HEX_SIZE = 38; // center to vertex in px

// Flat-top hex: width = size*2, height = size*sqrt(3)
const SQRT3 = Math.sqrt(3);

// Convert offset coord to pixel center (flat-top, odd-q offset)
export function hexToPixel(hex: HexCoord, size: number = HEX_SIZE): { x: number; y: number } {
  const x = size * 1.5 * hex.q;
  const y = size * SQRT3 * (hex.r + 0.5 * (hex.q & 1));
  return { x: x + size + 4, y: y + size + 4 }; // padding
}

// SVG polygon points for a flat-top hex centered at (cx, cy)
export function hexPolygonPoints(cx: number, cy: number, size: number = HEX_SIZE): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
  }
  return pts.join(" ");
}

// Total pixel dimensions for the grid SVG viewBox
export function gridPixelDimensions(size: number = HEX_SIZE): { width: number; height: number } {
  const last = hexToPixel({ q: GRID_COLS - 1, r: GRID_ROWS - 1 }, size);
  return { width: last.x + size + 8, height: last.y + size * SQRT3 * 0.5 + 8 };
}

// Convert offset (odd-q) to cube coordinates for distance calc
function toCube(hex: HexCoord): { x: number; y: number; z: number } {
  const x = hex.q;
  const z = hex.r - (hex.q - (hex.q & 1)) / 2;
  const y = -x - z;
  return { x, y, z };
}

// Hex distance via cube coordinates
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const ac = toCube(a);
  const bc = toCube(b);
  return Math.max(Math.abs(ac.x - bc.x), Math.abs(ac.y - bc.y), Math.abs(ac.z - bc.z));
}

export function isAdjacent(a: HexCoord, b: HexCoord): boolean {
  return hexDistance(a, b) === 1;
}

// Neighbor offsets for flat-top odd-q offset grid
const EVEN_Q_NEIGHBORS = [
  { dq: +1, dr:  0 }, { dq: +1, dr: -1 },
  { dq:  0, dr: -1 }, { dq: -1, dr: -1 },
  { dq: -1, dr:  0 }, { dq:  0, dr: +1 },
];
const ODD_Q_NEIGHBORS = [
  { dq: +1, dr: +1 }, { dq: +1, dr:  0 },
  { dq:  0, dr: -1 }, { dq: -1, dr:  0 },
  { dq: -1, dr: +1 }, { dq:  0, dr: +1 },
];

export function hexNeighbors(hex: HexCoord): HexCoord[] {
  const offsets = (hex.q & 1) === 0 ? EVEN_Q_NEIGHBORS : ODD_Q_NEIGHBORS;
  return offsets
    .map(d => ({ q: hex.q + d.dq, r: hex.r + d.dr }))
    .filter(h => h.q >= 0 && h.q < GRID_COLS && h.r >= 0 && h.r < GRID_ROWS);
}

// All hexes reachable within `range` steps, excluding occupied hexes
export function hexesInRange(
  center: HexCoord,
  range: number,
  occupied: Set<string> = new Set()
): HexCoord[] {
  // BFS to find reachable hexes respecting occupied blocking
  const visited = new Set<string>();
  const key = (h: HexCoord) => `${h.q},${h.r}`;
  visited.add(key(center));
  let frontier = [center];
  const result: HexCoord[] = [];

  for (let step = 0; step < range; step++) {
    const next: HexCoord[] = [];
    for (const hex of frontier) {
      for (const n of hexNeighbors(hex)) {
        const k = key(n);
        if (visited.has(k) || occupied.has(k)) continue;
        visited.add(k);
        next.push(n);
        result.push(n);
      }
    }
    frontier = next;
  }
  return result;
}

// Generate all grid coordinates
export function allHexes(): HexCoord[] {
  const hexes: HexCoord[] = [];
  for (let q = 0; q < GRID_COLS; q++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      hexes.push({ q, r });
    }
  }
  return hexes;
}
