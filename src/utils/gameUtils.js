export function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Terrain types
export const TERRAINS = ["plains", "forest", "mountain", "river", "ruins"];

export const TERRAIN_DEF = {
  plains: 0, forest: 100, mountain: 175, river: 0, ruins: 0,
};

export const TERRAIN_MOVE_COST = {
  plains: 1, forest: 1, mountain: 2, river: 1, ruins: 1,
};

export const TERRAIN_COLORS = {
  plains: "#8fbc6a",
  forest: "#2d6a1e",
  mountain: "#8a7a6a",
  river: "#4a90d9",
  ruins: "#9e8c6c",
};

// Unit definitions by tier
export const UNIT_DEFS = {
  scout:    { tier: 1, name: "Scout",    atk: 200, hp: 400,  cost: 3 },
  warrior:  { tier: 1, name: "Warrior",  atk: 300, hp: 500,  cost: 4 },
  archer:   { tier: 1, name: "Archer",   atk: 350, hp: 350,  cost: 4 },
  knight:   { tier: 2, name: "Knight",   atk: 500, hp: 700,  cost: 7 },
  mage:     { tier: 2, name: "Mage",     atk: 600, hp: 500,  cost: 8 },
  catapult: { tier: 2, name: "Catapult", atk: 700, hp: 400,  cost: 9 },
  dragon:   { tier: 3, name: "Dragon",   atk: 900, hp: 1000, cost: 14 },
  titan:    { tier: 3, name: "Titan",    atk: 800, hp: 1200, cost: 16 },
};

// Building definitions
export const BUILDING_DEFS = {
  fortification: { name: "Fortification", cost: 5, def: 150, hp: 500, description: "+150 DEF (500 HP)" },
  energy_structure: { name: "Energy Structure", cost: 6, hp: 400, description: "+2 Energy/turn (400 HP)" },
  knowledge_structure: { name: "Knowledge Structure", cost: 6, hp: 400, description: "+2 Knowledge/turn (+2 if Ruins) (400 HP)" },
  healing_structure: { name: "Healing Structure", cost: 5, hp: 400, description: "+2 HP heal/turn (400 HP)" },
};

// Tech definitions
export const TECH_DEFS = {
  elite_training:       { name: "Elite Training",       knCost: 4, tier: 2, description: "+150 ATK to all units" },
  siege_doctrine:       { name: "Siege Doctrine",       knCost: 5, tier: 2, description: "Ignore building DEF" },
  advanced_formations:  { name: "Advanced Formations",  knCost: 4, tier: 2, description: "Adjacency cap 300" },
  reinforced_structures:{ name: "Reinforced Structures", knCost: 3, tier: 1, description: "+50 building DEF" },
  mountain_training:    { name: "Mountain Training",    knCost: 3, tier: 1, description: "Mountain costs 1 action" },
  expanded_hand:        { name: "Expanded Hand",        knCost: 2, tier: 1, description: "Hand limit +2" },
  extra_actions:        { name: "Extra Actions",        knCost: 5, tier: 2, description: "+1 action per turn" },
};

// Tactical card definitions
export const TACTICAL_DEFS = [
  { name: "Power Strike",  description: "+200 ATK",         effect: { atkBonus: 200 } },
  { name: "Breach",         description: "-150 building DEF", effect: { buildingDefReduce: 150 } },
  { name: "Shield Wall",    description: "+150 DEF",         effect: { defBonus: 150 } },
  { name: "Field Medic",    description: "Heal 300 HP",      effect: { heal: 300 } },
];

// Create a 30-card deck
let _cardId = 0;
export function createDeck() {
  const cards = [];
  // Creatures (18)
  const creatures = [
    "scout", "scout", "scout",
    "warrior", "warrior", "warrior",
    "archer", "archer", "archer",
    "knight", "knight",
    "mage", "mage",
    "catapult", "catapult",
    "dragon",
    "titan",
    "scout",
  ];
  for (const unitKey of creatures) {
    const def = UNIT_DEFS[unitKey];
    cards.push({ id: `c-${_cardId++}`, type: "creature", unitKey, tier: def.tier, name: def.name, cost: def.cost, description: `ATK:${def.atk} HP:${def.hp}` });
  }
  // Buildings (4)
  for (const [bKey, bDef] of Object.entries(BUILDING_DEFS)) {
    cards.push({ id: `c-${_cardId++}`, type: "building", buildingKey: bKey, name: bDef.name, cost: bDef.cost, description: bDef.description });
  }
  // Tech (4)
  const techKeys = ["elite_training", "reinforced_structures", "mountain_training", "extra_actions"];
  for (const tKey of techKeys) {
    const t = TECH_DEFS[tKey];
    cards.push({ id: `c-${_cardId++}`, type: "tech", techKey: tKey, tier: t.tier, name: t.name, knCost: t.knCost, description: t.description });
  }
  // Tactical (4)
  for (const t of TACTICAL_DEFS) {
    cards.push({ id: `c-${_cardId++}`, type: "tactical", name: t.name, description: t.description, effect: t.effect });
  }
  return shuffle(cards);
}

// Combat calculation (unused standalone - logic is in gameActions.js)
// Kept for reference
export function calcDefenseValue(hex, board, defendPlayer, techState, getNeighborsFn, hexKeyFn) {
  let def = TERRAIN_DEF[hex.terrain] || 0;

  if (hex.building === "capital") def += 250;

  if (hex.building === "fortification") {
    def += 150;
    if (techState.reinforced_structures) def += 50;
  }

  const neighbors = getNeighborsFn(hex.q, hex.r);
  let adjCount = 0;
  for (const n of neighbors) {
    const nHex = board[hexKeyFn(n.q, n.r)];
    if (nHex && nHex.units.some(u => u.player === defendPlayer)) adjCount++;
  }
  const adjCap = techState.advanced_formations ? 300 : 225;
  def += Math.min(adjCount * 75, adjCap);

  // Adjacency soft decay
  if (hex.adjacencyDecay) def -= hex.adjacencyDecay;

  return Math.max(0, def);
}

// VP scoring
export function calcVP(board, player, capitalAlive) {
  let vp = 0;
  for (const hex of Object.values(board)) {
    if (hex.owner === player) {
      vp += 1;
      if (hex.building && hex.building !== "capital") vp += 2;
      if (hex.isObjective) vp += 3;
    }
    for (const u of hex.units) {
      if (u.player === player) {
        if (u.tier === 1) vp += 1;
        else if (u.tier === 2) vp += 3;
        else if (u.tier === 3) vp += 5;
      }
    }
  }
  if (capitalAlive) vp += 5;
  return vp;
}
