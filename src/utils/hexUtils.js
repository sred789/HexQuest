// Axial coordinate hex utilities for 127-hex grid (n=7, radius 6)
// Total = 3*7*(7-1)+1 = 127

const RADIUS = 6;

export function generateHexGrid() {
  const hexes = [];
  for (let q = -RADIUS; q <= RADIUS; q++) {
    const rMin = Math.max(-RADIUS, -q - RADIUS);
    const rMax = Math.min(RADIUS, -q + RADIUS);
    for (let r = rMin; r <= rMax; r++) {
      hexes.push({ q, r, s: -q - r });
    }
  }
  return hexes;
}

const DIRECTIONS = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

export function getNeighbors(q, r) {
  return DIRECTIONS.map(d => ({ q: q + d.q, r: r + d.r }));
}

export function axialToPixel(q, r, size) {
  const x = size * (3 / 2 * q);
  const y = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, y };
}

export function hexKey(q, r) {
  return `${q},${r}`;
}

export function hexDistance(q1, r1, q2, r2) {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

export function hexPointsString(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
  }
  return pts.join(" ");
}

// Get all hex keys within distance d of (q,r)
export function hexesInRange(q, r, d, boardKeys) {
  const result = [];
  for (let dq = -d; dq <= d; dq++) {
    const rMin = Math.max(-d, -dq - d);
    const rMax = Math.min(d, -dq + d);
    for (let dr = rMin; dr <= rMax; dr++) {
      const key = hexKey(q + dq, r + dr);
      if (boardKeys.has(key)) result.push(key);
    }
  }
  return result;
}

// Check if a hex is connected to the player's capital via owned territory
export function isConnectedToCapital(board, hexKey_, player) {
  // Find capital hex
  let capitalKey = null;
  for (const [key, hex] of Object.entries(board)) {
    if (hex.owner === player && hex.building === "capital") {
      capitalKey = key;
      break;
    }
  }
  if (!capitalKey) return false;
  if (hexKey_ === capitalKey) return true;

  // BFS from capital through owned hexes
  const visited = new Set();
  const queue = [capitalKey];
  visited.add(capitalKey);

  while (queue.length > 0) {
    const current = queue.shift();
    const hex = board[current];
    if (!hex) continue;
    const neighbors = getNeighbors(hex.q, hex.r);
    for (const n of neighbors) {
      const nKey = hexKey(n.q, n.r);
      if (visited.has(nKey)) continue;
      if (!board[nKey] || board[nKey].owner !== player) continue;
      if (nKey === hexKey_) return true;
      visited.add(nKey);
      queue.push(nKey);
    }
  }
  return false;
}

export { RADIUS };
