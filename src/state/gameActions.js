import { hexKey, getNeighbors, hexesInRange } from "../utils/hexUtils";
import { TERRAIN_DEF, TERRAIN_MOVE_COST, UNIT_DEFS, BUILDING_DEFS } from "../utils/gameUtils";

// Count controlled hexes
export function countControlled(board, player) {
  return Object.values(board).filter(h => h.owner === player).length;
}

// Command limit
export function commandLimit(board, player) {
  return Math.floor(countControlled(board, player) / 2);
}

// Count units
export function countUnits(board, player) {
  return Object.values(board).reduce((s, h) => s + h.units.filter(u => u.player === player).length, 0);
}

// Tier from hex count
export function getTier(hexCount) {
  if (hexCount >= 16) return 3;
  if (hexCount >= 8) return 2;
  return 1;
}

// Vision: all hex keys visible to a player
export function getVisibleHexes(board, player) {
  const boardKeys = new Set(Object.keys(board));
  const visible = new Set();
  for (const hex of Object.values(board)) {
    if (hex.owner === player) {
      const inRange = hexesInRange(hex.q, hex.r, 3, boardKeys);
      for (const k of inRange) visible.add(k);
    }
  }
  return visible;
}

// Check if capital alive
export function capitalAlive(board, player) {
  return Object.values(board).some(h => h.owner === player && h.building === "capital" && h.capitalHP > 0);
}

// START PHASE
export function executeStartPhase(state) {
  const p = state.currentTurn;
  let s = JSON.parse(JSON.stringify(state));
  let player = s.players[p];
  const logs = [];

  // 1) UPKEEP
  const cmdLimit = commandLimit(s.board, p);
  const unitCount = countUnits(s.board, p);
  if (unitCount > cmdLimit) {
    const excess = unitCount - cmdLimit;
    const upkeepCost = excess * 2;
    if (player.energy >= upkeepCost) {
      player.energy -= upkeepCost;
      logs.push(`P${p} pays ${upkeepCost} Energy upkeep (${excess} excess units)`);
    } else {
      player.energy = 0;
      logs.push(`P${p} cannot afford upkeep! Must destroy excess units.`);
    }
  }

  // 2) INCOME
  const controlled = countControlled(s.board, p);
  player.energy += controlled;
  logs.push(`P${p} income: +${controlled} Energy from ${controlled} hexes`);

  // 3) CAPITAL INCOME
  if (capitalAlive(s.board, p)) {
    player.energy += 1;
    player.knowledge += 1;
    logs.push(`P${p} capital: +1 Energy, +1 Knowledge`);
  }

  // 4) STRUCTURE INCOME
  for (const hex of Object.values(s.board)) {
    if (hex.owner === p && hex.building === "knowledge_structure") {
      const bonus = hex.terrain === "ruins" ? 4 : 2;
      player.knowledge += bonus;
      logs.push(`Knowledge Structure at (${hex.q},${hex.r}): +${bonus} Knowledge`);
    }
    if (hex.owner === p && hex.building === "energy_structure") {
      player.energy += 2;
    }
  }

  // 5) DRAW 2 keep 1
  if (player.deck.length === 0 && player.discard.length > 0) {
    player.deck = [...player.discard].sort(() => Math.random() - 0.5);
    player.discard = [];
    logs.push(`P${p} reshuffled discard into deck`);
  }
  const drawCards = [];
  for (let i = 0; i < 2 && player.deck.length > 0; i++) {
    drawCards.push(player.deck.shift());
  }

  // 6) ACTIONS
  let actions = 4;
  if (player.techs.extra_actions) actions += 1;
  actions = Math.min(actions, 6);

  // 7) TIER UPDATE
  const tier = getTier(controlled);

  // Reset unit flags
  for (const hex of Object.values(s.board)) {
    for (const u of hex.units) {
      if (u.player === p) {
        u.attackedThisTurn = false;
        u.movedThisTurn = false;
        u.summonedThisTurn = false;
        u.atkBuff = 0;
        u.defBuff = 0;
        u.breachBuff = 0;
      }
    }
    // Reset adjacency decay
    hex.adjacencyDecay = 0;
  }

  s.players[p] = player;
  s.actionsLeft = actions;
  s.log = [...s.log, ...logs];

  if (drawCards.length >= 2) {
    s.drawChoices = { cards: drawCards };
    s.phase = "draw";
  } else if (drawCards.length === 1) {
    player.hand.push(drawCards[0]);
    s.phase = "action";
  } else {
    s.phase = "action";
  }

  return s;
}

// Keep one card from draw choices
export function keepDrawCard(state, cardId) {
  let s = JSON.parse(JSON.stringify(state));
  const p = s.currentTurn;
  const player = s.players[p];
  const kept = s.drawChoices.cards.find(c => c.id === cardId);
  const discarded = s.drawChoices.cards.find(c => c.id !== cardId);
  if (kept) player.hand.push(kept);
  if (discarded) player.discard.push(discarded);
  s.drawChoices = null;
  s.phase = "action";
  s.log = [...s.log, `P${p} drew ${kept?.name || "card"}`];
  return s;
}

// MOVE action
export function moveUnits(state, fromKey, toKey, unitIds) {
  let s = JSON.parse(JSON.stringify(state));
  const p = s.currentTurn;
  const from = s.board[fromKey];
  const to = s.board[toKey];
  if (!from || !to) return s;

  // Check adjacency
  const neighbors = getNeighbors(from.q, from.r);
  if (!neighbors.some(n => hexKey(n.q, n.r) === toKey)) return s;

  // Movement cost
  let cost = TERRAIN_MOVE_COST[to.terrain] || 1;
  if (to.terrain === "mountain" && s.players[p].techs.mountain_training) cost = 1;
  if (s.actionsLeft < cost) return s;

  // Stacking check
  const existingFriendly = to.units.filter(u => u.player === p).length;
  if (existingFriendly + unitIds.length > 3) return s;

  // Cannot move into hex with enemy units (must attack instead)
  if (to.units.some(u => u.player !== p)) return s;

  const movedUnits = [];
  for (const uid of unitIds) {
    const idx = from.units.findIndex(u => u.id === uid && u.player === p && !u.attackedThisTurn);
    if (idx >= 0) {
      const unit = from.units.splice(idx, 1)[0];
      unit.movedThisTurn = true;
      movedUnits.push(unit);
    }
  }

  if (movedUnits.length === 0) return s;

  // Capture empty hex
  if (!to.owner || to.owner !== p) {
    if (to.units.length === 0) {
      // Destroy enemy building if present
      if (to.building && to.building !== "capital" && to.owner && to.owner !== p) {
        s.log = [...s.log, `P${p} destroyed enemy ${to.building} at (${to.q},${to.r})`];
        to.building = null;
      }
      to.owner = p;
    }
  }

  to.units.push(...movedUnits);
  s.actionsLeft -= cost;

  // ZOC check: stop if adjacent to enemy
  const toNeighbors = getNeighbors(to.q, to.r);
  const enemyAdjacent = toNeighbors.some(n => {
    const nHex = s.board[hexKey(n.q, n.r)];
    return nHex && nHex.units.some(u => u.player !== p);
  });

  s.log = [...s.log, `P${p} moved ${movedUnits.length} unit(s) to (${to.q},${to.r})${enemyAdjacent ? " (ZOC!)" : ""}`];
  return s;
}

// ATTACK action
export function attackHex(state, attackerHexKey, targetHexKey, targetUnitId, tacticalCards, attackerUnitId) {
  let s = JSON.parse(JSON.stringify(state));
  const p = s.currentTurn;
  const atkHex = s.board[attackerHexKey];
  const defHex = s.board[targetHexKey];
  if (!atkHex || !defHex || s.actionsLeft < 1) return s;

  // Check adjacency
  const neighbors = getNeighbors(atkHex.q, atkHex.r);
  if (!neighbors.some(n => hexKey(n.q, n.r) === targetHexKey)) return s;

  // Capital siege check
  if (defHex.building === "capital") {
    const capNeighbors = getNeighbors(defHex.q, defHex.r);
    const controlledAdj = capNeighbors.filter(n => {
      const nHex = s.board[hexKey(n.q, n.r)];
      return nHex && nHex.owner === p;
    }).length;
    if (controlledAdj < 2) {
      s.log = [...s.log, "Need 2 adjacent hexes to siege Capital!"];
      return s;
    }
  }

  // Find attacking unit (specific or first eligible)
  const attacker = attackerUnitId
    ? atkHex.units.find(u => u.id === attackerUnitId && u.player === p && !u.attackedThisTurn && !u.summonedThisTurn)
    : atkHex.units.find(u => u.player === p && !u.attackedThisTurn && !u.summonedThisTurn);
  if (!attacker) return s;

  // Calculate attack
  let atkValue = attacker.atk;
  if (attacker.atkBuff) { atkValue += attacker.atkBuff; attacker.atkBuff = 0; }
  if (s.players[p].techs.elite_training) atkValue += 150;

  // River penalty
  if (defHex.terrain === "river" && atkHex.terrain !== "river") atkValue -= 100;

  // Tactical bonuses
  let tacAtkBonus = 0;
  let tacDefReduce = 0;
  const player = s.players[p];
  if (tacticalCards && tacticalCards.length > 0) {
    for (const tc of tacticalCards.slice(0, 2)) {
      if (tc.effect.atkBonus) tacAtkBonus += tc.effect.atkBonus;
      if (tc.effect.buildingDefReduce) tacDefReduce += tc.effect.buildingDefReduce;
      // Remove from hand
      player.hand = player.hand.filter(c => c.id !== tc.id);
      player.discard.push(tc);
    }
  }
  atkValue += tacAtkBonus;

  // Calculate defense
  let def = TERRAIN_DEF[defHex.terrain] || 0;
  if (defHex.building === "capital") def += 250;
  if (defHex.building === "fortification") {
    let fortDef = 150;
    const defPlayer = defHex.units[0]?.player || defHex.owner;
    if (defPlayer && s.players[defPlayer]?.techs?.reinforced_structures) fortDef += 50;
    if (s.players[p].techs.siege_doctrine) fortDef = 0;
    if (attacker.breachBuff) { fortDef = Math.max(0, fortDef - attacker.breachBuff); attacker.breachBuff = 0; }
    fortDef = Math.max(0, fortDef - tacDefReduce);
    def += fortDef;
  }

  // Defender buff (Shield Wall)
  const defTarget = defHex.units.find(u => u.player !== p);
  if (defTarget && defTarget.defBuff) { def += defTarget.defBuff; defTarget.defBuff = 0; }

  // Adjacency defense
  const defPlayer = defHex.units[0]?.player || defHex.owner;
  if (defPlayer) {
    const defNeighbors = getNeighbors(defHex.q, defHex.r);
    let adjCount = 0;
    for (const n of defNeighbors) {
      const nHex = s.board[hexKey(n.q, n.r)];
      if (nHex && nHex.units.some(u => u.player === defPlayer)) adjCount++;
    }
    const adjCap = s.players[defPlayer]?.techs?.advanced_formations ? 300 : 225;
    def += Math.min(adjCount * 75, adjCap);
    def -= (defHex.adjacencyDecay || 0);
  }

  def = Math.max(0, def);
  const damage = Math.max(0, atkValue - def);

  // Apply damage
  let targetDestroyed = false;
  if (targetUnitId && defHex.units.length > 0) {
    // Attack specific unit
    const tIdx = defHex.units.findIndex(u => u.id === targetUnitId);
    if (tIdx >= 0) {
      defHex.units[tIdx].hp -= damage;
      s.log = [...s.log, `P${p} ${attacker.type} attacks ${defHex.units[tIdx].type}: ${atkValue} ATK vs ${def} DEF = ${damage} damage (HP: ${defHex.units[tIdx].hp}/${defHex.units[tIdx].maxHp})`];
      if (defHex.units[tIdx].hp <= 0) {
        defHex.units.splice(tIdx, 1);
        targetDestroyed = true;
      }
    }
  } else if (defHex.building === "capital" && defHex.capitalHP > 0) {
    // Attack capital
    defHex.capitalHP -= damage;
    s.log = [...s.log, `P${p} ${attacker.type} attacks Capital: ${atkValue} ATK vs ${def} DEF = ${damage} damage (Capital HP: ${defHex.capitalHP}/1600)`];
    if (defHex.capitalHP <= 0) {
      s.winner = `Player ${p}`;
      s.log = [...s.log, `Player ${p} destroyed enemy Capital! VICTORY!`];
    }
  } else if (defHex.units.length > 0) {
    // Attack first unit
    defHex.units[0].hp -= damage;
    s.log = [...s.log, `P${p} ${attacker.type} attacks ${defHex.units[0].type}: ${atkValue} ATK vs ${def} DEF = ${damage} damage`];
    if (defHex.units[0].hp <= 0) {
      defHex.units.shift();
      targetDestroyed = true;
    }
  }

  // Adjacency soft decay
  if (damage > 0) {
    defHex.adjacencyDecay = (defHex.adjacencyDecay || 0) + 75;
  }

  // Capture if no enemy units left
  if (defHex.units.filter(u => u.player !== p).length === 0 && defHex.owner !== p) {
    if (defHex.building !== "capital" || defHex.capitalHP <= 0) {
      defHex.owner = p;
      if (defHex.building && defHex.building !== "capital") {
        s.log = [...s.log, `Captured hex and destroyed ${defHex.building}`];
        defHex.building = null;
      }
    }
  }

  attacker.attackedThisTurn = true;
  s.actionsLeft -= 1;
  s.players[p] = player;
  return s;
}

// PLAY CREATURE
export function playCreature(state, cardId, hexKey_) {
  let s = JSON.parse(JSON.stringify(state));
  const p = s.currentTurn;
  const player = s.players[p];
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx < 0 || s.actionsLeft < 1) return s;

  const card = player.hand[cardIdx];
  if (card.type !== "creature") return s;

  const hex = s.board[hexKey_];
  if (!hex || hex.owner !== p) return s;
  if (hex.units.filter(u => u.player === p).length >= 3) return s;

  // Tier check
  const controlled = countControlled(s.board, p);
  const tier = getTier(controlled);
  if (card.tier > tier) {
    s.log = [...s.log, `Need Tier ${card.tier} (${card.tier === 2 ? "8" : "16"}+ hexes) to play ${card.name}`];
    return s;
  }

  if (player.energy < card.cost) {
    s.log = [...s.log, `Not enough Energy (need ${card.cost}, have ${player.energy})`];
    return s;
  }

  const def = UNIT_DEFS[card.unitKey];
  const uid = `p${p}-u${player.nextUnitId++}`;
  hex.units.push({
    id: uid, player: p, type: card.unitKey, tier: def.tier,
    atk: def.atk, hp: def.hp, maxHp: def.hp,
    attackedThisTurn: false, summonedThisTurn: true, movedThisTurn: false,
  });

  player.energy -= card.cost;
  player.hand.splice(cardIdx, 1);
  player.discard.push(card);
  s.actionsLeft -= 1;
  s.log = [...s.log, `P${p} summoned ${card.name} at (${hex.q},${hex.r})`];
  return s;
}

// PLAY BUILDING
export function playBuilding(state, cardId, hexKey_) {
  let s = JSON.parse(JSON.stringify(state));
  const p = s.currentTurn;
  const player = s.players[p];
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx < 0 || s.actionsLeft < 1) return s;

  const card = player.hand[cardIdx];
  if (card.type !== "building") return s;

  const hex = s.board[hexKey_];
  if (!hex || hex.owner !== p || hex.building) return s;

  if (player.energy < card.cost) {
    s.log = [...s.log, `Not enough Energy (need ${card.cost})`];
    return s;
  }

  hex.building = card.buildingKey;
  player.energy -= card.cost;
  player.hand.splice(cardIdx, 1);
  player.discard.push(card);
  s.actionsLeft -= 1;
  s.log = [...s.log, `P${p} built ${card.name} at (${hex.q},${hex.r})`];
  return s;
}

// PLAY TECH
export function playTech(state, cardId) {
  let s = JSON.parse(JSON.stringify(state));
  const p = s.currentTurn;
  const player = s.players[p];
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx < 0 || s.actionsLeft < 1) return s;

  const card = player.hand[cardIdx];
  if (card.type !== "tech") return s;
  if (player.techs[card.techKey]) {
    s.log = [...s.log, "Already researched!"];
    return s;
  }

  const controlled = countControlled(s.board, p);
  const tier = getTier(controlled);
  if (card.tier > tier) {
    s.log = [...s.log, `Need Tier ${card.tier} for ${card.name}`];
    return s;
  }

  if (player.knowledge < card.knCost) {
    s.log = [...s.log, `Not enough Knowledge (need ${card.knCost})`];
    return s;
  }

  player.knowledge -= card.knCost;
  player.techs[card.techKey] = true;
  player.hand.splice(cardIdx, 1);
  // Tech removed from game, not to discard
  s.actionsLeft -= 1;
  s.log = [...s.log, `P${p} researched ${card.name}`];
  return s;
}

// PLAY TACTICAL
export function playTactical(state, cardId, hexKey_) {
  let s = JSON.parse(JSON.stringify(state));
  const p = s.currentTurn;
  const player = s.players[p];
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx < 0 || s.actionsLeft < 1) return s;

  const card = player.hand[cardIdx];
  if (card.type !== "tactical") return s;

  const hex = s.board[hexKey_];
  if (!hex || hex.owner !== p) return s;

  const myUnits = hex.units.filter(u => u.player === p);
  if (myUnits.length === 0) return s;

  const effect = card.effect;

  if (effect.heal) {
    const damaged = myUnits.filter(u => u.hp < u.maxHp).sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
    if (damaged.length === 0) {
      s.log = [...s.log, "No damaged units to heal"];
      return s;
    }
    const target = damaged[0];
    const healAmt = Math.min(effect.heal, target.maxHp - target.hp);
    target.hp += healAmt;
    s.log = [...s.log, `P${p} used ${card.name}: healed ${target.type} for ${healAmt} HP`];
  } else if (effect.atkBonus) {
    for (const u of myUnits) u.atkBuff = (u.atkBuff || 0) + effect.atkBonus;
    s.log = [...s.log, `P${p} used ${card.name}: +${effect.atkBonus} ATK to units at (${hex.q},${hex.r})`];
  } else if (effect.defBonus) {
    for (const u of myUnits) u.defBuff = (u.defBuff || 0) + effect.defBonus;
    s.log = [...s.log, `P${p} used ${card.name}: +${effect.defBonus} DEF to units at (${hex.q},${hex.r})`];
  } else if (effect.buildingDefReduce) {
    for (const u of myUnits) u.breachBuff = (u.breachBuff || 0) + effect.buildingDefReduce;
    s.log = [...s.log, `P${p} used ${card.name}: units at (${hex.q},${hex.r}) ignore ${effect.buildingDefReduce} building DEF`];
  }

  player.hand.splice(cardIdx, 1);
  player.discard.push(card);
  s.actionsLeft -= 1;
  return s;
}

// END TURN
export function endTurn(state) {
  let s = JSON.parse(JSON.stringify(state));
  const p = s.currentTurn;
  const player = s.players[p];

  // HEALING
  for (const hex of Object.values(s.board)) {
    for (const u of hex.units) {
      if (u.player === p && !u.attackedThisTurn) {
        u.hp = Math.min(u.maxHp, u.hp + 1);
        if (hex.building === "healing_structure" && hex.owner === p) {
          u.hp = Math.min(u.maxHp, u.hp + 2);
        }
      }
    }
  }

  // HAND LIMIT
  while (player.hand.length > player.handLimit) {
    player.discard.push(player.hand.pop());
  }

  // Check win conditions
  const hexCount = Object.keys(s.board).length;
  const controlled = countControlled(s.board, p);
  if (controlled / hexCount >= 0.8) {
    s.winner = `Player ${p}`;
    s.log = [...s.log, `Player ${p} controls 80%+ of the map! VICTORY!`];
  }

  // Check turn 30
  const nextPlayer = p === 1 ? 2 : 1;
  const nextTurn = p === 2 ? s.turnNumber + 1 : s.turnNumber;

  if (nextTurn > 30 && !s.winner) {
    // Score VP
    const vp1 = calcVP(s.board, 1, capitalAlive(s.board, 1));
    const vp2 = calcVP(s.board, 2, capitalAlive(s.board, 2));
    s.log = [...s.log, `Turn 30 reached! VP: P1=${vp1}, P2=${vp2}`];
    s.winner = vp1 > vp2 ? "Player 1" : vp2 > vp1 ? "Player 2" : "Tie";
  }

  s.currentTurn = nextPlayer;
  s.turnNumber = nextTurn;
  s.phase = "start";
  s.selectedHex = null;
  s.tacticalPlayed = 0;
  s.log = [...s.log, `Player ${nextPlayer}'s turn (Turn ${nextTurn}).`];
  return s;
}

function calcVP(board, player, capAlive) {
  let vp = 0;
  for (const hex of Object.values(board)) {
    if (hex.owner === player) {
      vp += 1;
      if (hex.building && hex.building !== "capital") vp += 2;
      if (hex.isObjective) vp += 3;
    }
    for (const u of hex.units) {
      if (u.player === player) {
        vp += u.tier === 1 ? 1 : u.tier === 2 ? 3 : 5;
      }
    }
  }
  if (capAlive) vp += 5;
  return vp;
}
