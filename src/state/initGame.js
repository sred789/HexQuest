import { generateHexGrid, hexKey, getNeighbors, RADIUS } from "../utils/hexUtils";
import { shuffle, TERRAINS, createDeck } from "../utils/gameUtils";

export function createInitialState() {
  const coords = generateHexGrid();

  // P1 top edge, P2 bottom edge
  const p1Capital = { q: 0, r: -RADIUS };
  const p2Capital = { q: 0, r: RADIUS };

  // Generate mirrored terrain
  const terrainWeights = { plains: 40, forest: 25, mountain: 15, river: 10, ruins: 10 };
  const terrainTypes = [];
  for (const [t, w] of Object.entries(terrainWeights)) {
    for (let i = 0; i < w; i++) terrainTypes.push(t);
  }

  // Assign terrain to upper half, mirror to lower
  const terrainMap = {};
  for (const { q, r } of coords) {
    const key = hexKey(q, r);
    if (r < 0) {
      terrainMap[key] = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];
    } else if (r === 0 && q !== 0) {
      terrainMap[key] = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];
    }
  }
  // Mirror
  for (const { q, r } of coords) {
    const key = hexKey(q, r);
    if (!terrainMap[key]) {
      const mirrorKey = hexKey(-q, -r);
      terrainMap[key] = terrainMap[mirrorKey] || "plains";
    }
  }
  // Capitals get plains
  terrainMap[hexKey(p1Capital.q, p1Capital.r)] = "plains";
  terrainMap[hexKey(p2Capital.q, p2Capital.r)] = "plains";

  // Select 3 strategic objective hexes (middle ring)
  const midHexes = coords.filter(c => {
    const dist = Math.max(Math.abs(c.q), Math.abs(c.r), Math.abs(c.q + c.r));
    return dist >= 2 && dist <= 4 && c.r !== -RADIUS && c.r !== RADIUS;
  });
  const objectives = new Set();
  const shuffledMid = shuffle(midHexes);
  for (let i = 0; i < Math.min(3, shuffledMid.length); i++) {
    objectives.add(hexKey(shuffledMid[i].q, shuffledMid[i].r));
  }

  // Build board
  const board = {};
  for (const { q, r } of coords) {
    const key = hexKey(q, r);
    const isP1Cap = q === p1Capital.q && r === p1Capital.r;
    const isP2Cap = q === p2Capital.q && r === p2Capital.r;

    board[key] = {
      q, r,
      terrain: terrainMap[key],
      owner: isP1Cap ? 1 : isP2Cap ? 2 : null,
      building: isP1Cap ? "capital" : isP2Cap ? "capital" : null,
      capitalHP: isP1Cap || isP2Cap ? 1600 : 0,
      buildingHP: 0,
      units: [],
      isObjective: objectives.has(key),
      adjacencyDecay: 0,
    };
  }

  // Place starting units
  const p1Key = hexKey(p1Capital.q, p1Capital.r);
  const p2Key = hexKey(p2Capital.q, p2Capital.r);
  board[p1Key].units.push({ id: "p1-u0", player: 1, type: "scout", tier: 1, atk: 200, hp: 400, maxHp: 400, attackedThisTurn: false, summonedThisTurn: false, movedThisTurn: false });
  board[p2Key].units.push({ id: "p2-u0", player: 2, type: "scout", tier: 1, atk: 200, hp: 400, maxHp: 400, attackedThisTurn: false, summonedThisTurn: false, movedThisTurn: false });

  // Give each player 2 starting territories adjacent to their capital
  const p1Neighbors = getNeighbors(p1Capital.q, p1Capital.r).filter(n => board[hexKey(n.q, n.r)]);
  const p2Neighbors = getNeighbors(p2Capital.q, p2Capital.r).filter(n => board[hexKey(n.q, n.r)]);
  for (let i = 0; i < Math.min(2, p1Neighbors.length); i++) {
    board[hexKey(p1Neighbors[i].q, p1Neighbors[i].r)].owner = 1;
  }
  for (let i = 0; i < Math.min(2, p2Neighbors.length); i++) {
    board[hexKey(p2Neighbors[i].q, p2Neighbors[i].r)].owner = 2;
  }

  return {
    board,
    currentTurn: 1,
    turnNumber: 1,
    actionsLeft: 4,
    phase: "action", // start, action, end
    players: {
      1: {
        name: "Player 1",
        energy: 5,
        knowledge: 3,
        hand: [],
        deck: createDeck(),
        discard: [],
        techs: {},
        handLimit: 7,
        nextUnitId: 1,
      },
      2: {
        name: "Player 2",
        energy: 6,
        knowledge: 3,
        hand: [],
        deck: createDeck(),
        discard: [],
        techs: {},
        handLimit: 7,
        nextUnitId: 1,
      },
    },
    selectedHex: null,
    selectedUnit: null,
    winner: null,
    log: ["Game started! Player 1's turn."],
    drawChoices: null, // {cards: [c1,c2], phase: "choosing"}
    tacticalPlayed: 0, // count for current combat
    discoveredHexes: { 1: [], 2: [] }, // arrays of hex keys each player has discovered
  };
}

// Draw initial hands
export function drawInitialHands(state) {
  const s = { ...state, players: { ...state.players } };
  for (const p of [1, 2]) {
    const player = { ...s.players[p], deck: [...s.players[p].deck], hand: [...s.players[p].hand] };
    for (let i = 0; i < 5 && player.deck.length > 0; i++) {
      player.hand.push(player.deck.shift());
    }
    s.players[p] = player;
  }
  return s;
}
