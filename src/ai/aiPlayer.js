import { hexKey, getNeighbors, hexDistance } from "../utils/hexUtils";
import { TERRAIN_DEF, TERRAIN_MOVE_COST, UNIT_DEFS } from "../utils/gameUtils";
import { getVisibleHexes, countControlled, countUnits, commandLimit, getTier } from "../state/gameActions";

const AI_PLAYER = 2;

// Score draw cards by current needs
export function aiChooseDrawCard(game) {
  const p = game.players[AI_PLAYER];
  const controlled = countControlled(game.board, AI_PLAYER);
  const units = countUnits(game.board, AI_PLAYER);
  const cmdLimit = commandLimit(game.board, AI_PLAYER);
  const tier = getTier(controlled);

  const needsUnits = units < cmdLimit;
  const needsEconomy = p.energy < 8;
  const needsTech = p.knowledge >= 3 && Object.keys(p.techs).length < 3;

  const cards = game.drawChoices.cards;
  let bestCard = cards[0];
  let bestScore = -Infinity;

  for (const card of cards) {
    let score = 0;
    if (card.type === "creature") {
      score += needsUnits ? 5 : 2;
      if (card.tier <= tier) score += 3;
      else score -= 2;
    } else if (card.type === "building") {
      score += needsEconomy && card.buildingKey === "energy_structure" ? 6 : 3;
      if (card.buildingKey === "fortification") score += 2;
    } else if (card.type === "tech") {
      score += needsTech ? 5 : 2;
      if (card.techKey === "extra_actions") score += 3;
      if (card.techKey === "elite_training" && units >= 3) score += 3;
      if (card.tier > tier) score -= 3;
    } else if (card.type === "tactical") {
      score += 2;
      if (card.effect.atkBonus) score += 2;
      if (card.effect.heal) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCard = card;
    }
  }

  return bestCard.id;
}

// Main AI decision: returns the single best action or null/endTurn
export function aiPlanNextAction(game) {
  const visible = getVisibleHexes(game.board, AI_PLAYER);
  const p = game.players[AI_PLAYER];
  const controlled = countControlled(game.board, AI_PLAYER);
  const units = countUnits(game.board, AI_PLAYER);
  const cmdLimit = commandLimit(game.board, AI_PLAYER);
  const tier = getTier(controlled);

  // Game phase multipliers
  const turn = game.turnNumber;
  const earlyGame = turn <= 8;
  const midGame = turn > 8 && turn <= 20;
  const lateGame = turn > 20;

  const candidates = [];

  // Find enemy capital position for distance calculations
  let enemyCapitalPos = null;
  for (const hex of Object.values(game.board)) {
    if (hex.building === "capital" && hex.owner === 1) {
      enemyCapitalPos = { q: hex.q, r: hex.r };
      break;
    }
  }

  // --- ATTACKS ---
  for (const key of Object.keys(game.board)) {
    const hex = game.board[key];
    if (hex.units.length === 0) continue;
    const myUnits = hex.units.filter(u => u.player === AI_PLAYER && !u.attackedThisTurn && !u.summonedThisTurn);
    if (myUnits.length === 0) continue;

    const neighbors = getNeighbors(hex.q, hex.r);
    for (const n of neighbors) {
      const nKey = hexKey(n.q, n.r);
      const nHex = game.board[nKey];
      if (!nHex || !visible.has(nKey)) continue;

      // Attack enemy units
      const enemyUnits = nHex.units.filter(u => u.player !== AI_PLAYER);
      if (enemyUnits.length > 0) {
        const attacker = myUnits[0];
        const target = enemyUnits[0];
        const damage = estimateDamage(game, hex, nHex, attacker, p);

        let score = 3;
        if (damage >= target.hp) score += 10; // kill shot
        if (damage > 0) score += 3;
        if (damage <= 0) score -= 5;
        if (lateGame) score *= 1.3;

        candidates.push({
          type: "attack", score,
          from: key, to: nKey, targetUnitId: target.id, attackerUnitId: attacker.id,
        });
      }

      // Attack capital
      if (nHex.building === "capital" && nHex.owner === 1 && nHex.capitalHP > 0 && enemyUnits.length === 0) {
        const capNeighbors = getNeighbors(nHex.q, nHex.r);
        const controlledAdj = capNeighbors.filter(cn => {
          const cHex = game.board[hexKey(cn.q, cn.r)];
          return cHex && cHex.owner === AI_PLAYER;
        }).length;
        if (controlledAdj >= 2) {
          const attacker = myUnits[0];
          let score = 12;
          if (lateGame) score *= 1.5;
          candidates.push({
            type: "attack", score,
            from: key, to: nKey, targetUnitId: null, attackerUnitId: attacker.id,
          });
        }
      }
    }
  }

  // --- MOVEMENTS ---
  for (const key of Object.keys(game.board)) {
    const hex = game.board[key];
    if (hex.units.length === 0) continue;
    const myUnits = hex.units.filter(u => u.player === AI_PLAYER && !u.attackedThisTurn);
    if (myUnits.length === 0) continue;

    const neighbors = getNeighbors(hex.q, hex.r);
    for (const n of neighbors) {
      const nKey = hexKey(n.q, n.r);
      const nHex = game.board[nKey];
      if (!nHex) continue;
      if (nHex.units.some(u => u.player !== AI_PLAYER)) continue; // can't move into enemies
      const friendlyAtDest = nHex.units.filter(u => u.player === AI_PLAYER).length;
      if (friendlyAtDest + myUnits.length > 3) continue;

      const moveCost = TERRAIN_MOVE_COST[nHex.terrain] || 1;
      if (nHex.terrain === "mountain" && p.techs.mountain_training) {
        // cost is 1
      } else if (game.actionsLeft < moveCost) continue;

      let score = 0;
      // Expansion: unclaimed hex
      if (!nHex.owner) score += 3;
      // Capture empty enemy hex
      else if (nHex.owner === 1 && nHex.units.filter(u => u.player === 1).length === 0) score += 4;
      // Objective
      if (nHex.isObjective && nHex.owner !== AI_PLAYER) score += 6;

      // Advance toward enemy territory
      if (enemyCapitalPos) {
        const currentDist = hexDistance(hex.q, hex.r, enemyCapitalPos.q, enemyCapitalPos.r);
        const newDist = hexDistance(n.q, n.r, enemyCapitalPos.q, enemyCapitalPos.r);
        if (newDist < currentDist) score += 1.5;
        if (newDist > currentDist) score -= 1;
      }

      // Don't waste moves on already owned hexes with no strategic value
      if (nHex.owner === AI_PLAYER && !nHex.isObjective) score -= 2;

      // Phase multipliers
      if (earlyGame) score *= 1.4; // favor expansion
      if (midGame && nHex.owner === 1) score *= 1.2;
      if (lateGame) score *= 1.1;

      // Mountain cost penalty
      if (moveCost > 1) score -= 1;

      const unitIds = myUnits.map(u => u.id);
      candidates.push({ type: "move", score, from: key, to: nKey, unitIds });
    }
  }

  // --- CREATURE SUMMONING ---
  if (units < cmdLimit) {
    const creatureCards = p.hand.filter(c => c.type === "creature" && c.tier <= tier && c.cost <= p.energy);
    for (const card of creatureCards) {
      // Find best hex to summon on (near front line)
      let bestHex = null;
      let bestPlaceScore = -Infinity;

      for (const key of Object.keys(game.board)) {
        const hex = game.board[key];
        if (hex.owner !== AI_PLAYER) continue;
        if (hex.units.filter(u => u.player === AI_PLAYER).length >= 3) continue;

        let placeScore = 0;
        // Near front: adjacent to non-owned hexes
        const neighbors = getNeighbors(hex.q, hex.r);
        for (const n of neighbors) {
          const nHex = game.board[hexKey(n.q, n.r)];
          if (nHex && nHex.owner !== AI_PLAYER) placeScore += 1;
          if (nHex && nHex.units.some(u => u.player === 1)) placeScore += 2;
        }
        if (enemyCapitalPos) {
          const dist = hexDistance(hex.q, hex.r, enemyCapitalPos.q, enemyCapitalPos.r);
          placeScore += Math.max(0, 10 - dist);
        }

        if (placeScore > bestPlaceScore) {
          bestPlaceScore = placeScore;
          bestHex = key;
        }
      }

      if (bestHex) {
        let score = 5;
        if (units < cmdLimit - 1) score += 2;
        if (midGame) score *= 1.3;
        if (card.tier >= 2) score += 2;
        candidates.push({ type: "playCreature", score, cardId: card.id, hexKey: bestHex });
      }
    }
  }

  // --- BUILDINGS ---
  const buildingCards = p.hand.filter(c => c.type === "building" && c.cost <= p.energy);
  for (const card of buildingCards) {
    for (const key of Object.keys(game.board)) {
      const hex = game.board[key];
      if (hex.owner !== AI_PLAYER || hex.building) continue;

      let score = 0;
      if (card.buildingKey === "energy_structure") {
        score = p.energy < 10 ? 5 : 2;
        if (earlyGame) score += 2;
      } else if (card.buildingKey === "knowledge_structure") {
        score = 3;
        if (hex.terrain === "ruins") score += 4;
      } else if (card.buildingKey === "fortification") {
        // Near front
        const neighbors = getNeighbors(hex.q, hex.r);
        const nearEnemy = neighbors.some(n => {
          const nHex = game.board[hexKey(n.q, n.r)];
          return nHex && (nHex.owner === 1 || nHex.units.some(u => u.player === 1));
        });
        score = nearEnemy ? 5 : 1;
      } else if (card.buildingKey === "healing_structure") {
        score = 2;
      }

      // Only build on reasonably placed hexes (not at the very back)
      if (enemyCapitalPos) {
        const dist = hexDistance(hex.q, hex.r, enemyCapitalPos.q, enemyCapitalPos.r);
        if (dist > 10) score -= 2; // far from action
      }

      if (score > 2) {
        candidates.push({ type: "playBuilding", score, cardId: card.id, hexKey: key });
      }
    }
  }

  // --- TECH ---
  const techCards = p.hand.filter(c => c.type === "tech" && c.tier <= tier && c.knCost <= p.knowledge && !p.techs[c.techKey]);
  for (const card of techCards) {
    let score = 4;
    if (card.techKey === "extra_actions") score += 5;
    if (card.techKey === "elite_training" && units >= 3) score += 4;
    if (card.techKey === "mountain_training") score += 1;
    if (card.techKey === "reinforced_structures") score += 2;
    candidates.push({ type: "playTech", score, cardId: card.id });
  }

  // --- TACTICAL ---
  const tacticalCards = p.hand.filter(c => c.type === "tactical");
  for (const card of tacticalCards) {
    // Power Strike: use before attack on hex with units near enemies
    if (card.effect.atkBonus) {
      for (const key of Object.keys(game.board)) {
        const hex = game.board[key];
        const myUnits = hex.units.filter(u => u.player === AI_PLAYER && !u.attackedThisTurn && !u.summonedThisTurn);
        if (myUnits.length === 0) continue;
        const neighbors = getNeighbors(hex.q, hex.r);
        const hasEnemyAdj = neighbors.some(n => {
          const nHex = game.board[hexKey(n.q, n.r)];
          return nHex && visible.has(hexKey(n.q, n.r)) && nHex.units.some(u => u.player === 1);
        });
        if (hasEnemyAdj) {
          candidates.push({ type: "playTactical", score: 6, cardId: card.id, hexKey: key });
          break; // one placement per card
        }
      }
    }

    // Field Medic: heal damaged units
    if (card.effect.heal) {
      for (const key of Object.keys(game.board)) {
        const hex = game.board[key];
        const damaged = hex.units.filter(u => u.player === AI_PLAYER && u.hp < u.maxHp);
        if (damaged.length > 0) {
          const hpLost = damaged.reduce((s, u) => s + (u.maxHp - u.hp), 0);
          const score = Math.min(6, 2 + hpLost / 200);
          candidates.push({ type: "playTactical", score, cardId: card.id, hexKey: key });
          break;
        }
      }
    }

    // Shield Wall: use on front-line hex
    if (card.effect.defBonus) {
      for (const key of Object.keys(game.board)) {
        const hex = game.board[key];
        const myUnits = hex.units.filter(u => u.player === AI_PLAYER);
        if (myUnits.length === 0) continue;
        const neighbors = getNeighbors(hex.q, hex.r);
        const hasEnemyAdj = neighbors.some(n => {
          const nHex = game.board[hexKey(n.q, n.r)];
          return nHex && nHex.units.some(u => u.player === 1);
        });
        if (hasEnemyAdj) {
          candidates.push({ type: "playTactical", score: 4, cardId: card.id, hexKey: key });
          break;
        }
      }
    }

    // Breach: use before attacking fortified hex
    if (card.effect.buildingDefReduce) {
      for (const key of Object.keys(game.board)) {
        const hex = game.board[key];
        const myUnits = hex.units.filter(u => u.player === AI_PLAYER && !u.attackedThisTurn && !u.summonedThisTurn);
        if (myUnits.length === 0) continue;
        const neighbors = getNeighbors(hex.q, hex.r);
        const hasFortifiedEnemy = neighbors.some(n => {
          const nKey = hexKey(n.q, n.r);
          const nHex = game.board[nKey];
          return nHex && visible.has(nKey) && nHex.owner === 1 && nHex.building === "fortification";
        });
        if (hasFortifiedEnemy) {
          candidates.push({ type: "playTactical", score: 5, cardId: card.id, hexKey: key });
          break;
        }
      }
    }
  }

  // Pick best action
  if (candidates.length === 0) return { type: "endTurn" };

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  // Don't take bad actions
  if (best.score <= 0) return { type: "endTurn" };

  return best;
}

// Estimate damage for attack scoring
function estimateDamage(game, atkHex, defHex, attacker, player) {
  let atkValue = attacker.atk;
  if (attacker.atkBuff) atkValue += attacker.atkBuff;
  if (player.techs.elite_training) atkValue += 150;
  if (defHex.terrain === "river" && atkHex.terrain !== "river") atkValue -= 100;

  let def = TERRAIN_DEF[defHex.terrain] || 0;
  if (defHex.building === "capital") def += 250;
  if (defHex.building === "fortification") {
    let fortDef = 150;
    const defOwner = defHex.owner;
    if (defOwner && game.players[defOwner]?.techs?.reinforced_structures) fortDef += 50;
    if (player.techs.siege_doctrine) fortDef = 0;
    if (attacker.breachBuff) fortDef = Math.max(0, fortDef - attacker.breachBuff);
    def += fortDef;
  }

  // Defender buff
  const defTarget = defHex.units.find(u => u.player !== AI_PLAYER);
  if (defTarget && defTarget.defBuff) def += defTarget.defBuff;

  // Adjacency defense
  const defPlayer = defHex.units[0]?.player || defHex.owner;
  if (defPlayer) {
    const defNeighbors = getNeighbors(defHex.q, defHex.r);
    let adjCount = 0;
    for (const n of defNeighbors) {
      const nHex = game.board[hexKey(n.q, n.r)];
      if (nHex && nHex.units.some(u => u.player === defPlayer)) adjCount++;
    }
    const adjCap = game.players[defPlayer]?.techs?.advanced_formations ? 300 : 225;
    def += Math.min(adjCount * 75, adjCap);
    def -= (defHex.adjacencyDecay || 0);
  }

  def = Math.max(0, def);
  return Math.max(0, atkValue - def);
}
