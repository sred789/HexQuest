import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { ThemeProvider, createTheme, CssBaseline, Box } from "@mui/material";
import { hexKey, getNeighbors } from "./utils/hexUtils";
import { countAdjacentOwned } from "./state/gameActions";
import { createInitialState, drawInitialHands } from "./state/initGame";
import { getVisibleHexes, getDiscoveredHexes, updateDiscoveredHexes, executeStartPhase, keepDrawCard, moveUnits, attackHex, playCreature, playBuilding, playTech, playTactical, endTurn } from "./state/gameActions";
import Board from "./components/Board";
import PlayerPanel from "./components/PlayerPanel";
import ActionBar from "./components/ActionBar";
import HexInfo from "./components/HexInfo";
import GameLog from "./components/GameLog";
import DrawModal from "./components/DrawModal";
import WinModal from "./components/WinModal";
import ModeSelect from "./components/ModeSelect";
import { executeAiTurn } from "./ai/aiExecutor";

const darkTheme = createTheme({ palette: { mode: "dark" } });

function freshGame() {
  return drawInitialHands(createInitialState());
}

export default function App() {
  const [gameMode, setGameMode] = useState(null); // null, "human", "ai"
  const [game, setGame] = useState(freshGame);
  const [selectedHexKey_, setSelectedHexKey] = useState(null);
  const [mode, setMode] = useState(null); // null, "move", "attack", "playCreature", "playBuilding", "playTactical"
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [floatingTexts, setFloatingTexts] = useState([]);
  const [logHeight, setLogHeight] = useState(70);
  const [aiRunning, setAiRunning] = useState(false);
  const notifTimer = useRef(null);
  const aiCancelRef = useRef(null);

  const showNotification = useCallback((msg) => {
    if (notifTimer.current) clearTimeout(notifTimer.current);
    setNotification(msg);
    notifTimer.current = setTimeout(() => setNotification(null), 2000);
  }, []);

  const addFloatingText = useCallback((q, r, text, color = "#fff") => {
    const id = Date.now() + Math.random();
    setFloatingTexts(prev => [...prev, { id, q, r, text, color }]);
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(ft => ft.id !== id));
    }, 2000);
  }, []);

  const selectedHex = selectedHexKey_ ? game.board[selectedHexKey_] : null;

  // In AI mode: show P1's discovered view on P1's turn,
  // show ONLY AI's owned hexes during AI turn (no discovered/vision range)
  // In human mode: show current player's discovered view
  const viewPlayer = gameMode === "ai" ? (game.currentTurn === 2 ? 2 : 1) : game.currentTurn;
  const visibleHexes = useMemo(() => {
    if (gameMode === "ai" && game.currentTurn === 2) {
      // AI turn: only show hexes owned by AI
      const owned = new Set();
      for (const [key, hex] of Object.entries(game.board)) {
        if (hex.owner === 2) owned.add(key);
      }
      return owned;
    }
    return getDiscoveredHexes(game.board, viewPlayer, game.discoveredHexes?.[viewPlayer]);
  }, [game.board, viewPlayer, game.discoveredHexes, gameMode, game.currentTurn]);

  // Update discovered hexes whenever board changes
  useEffect(() => {
    setGame(g => {
      const p1Discovered = updateDiscoveredHexes(g, 1);
      const p2Discovered = updateDiscoveredHexes(g, 2);
      const oldP1 = g.discoveredHexes?.[1] || [];
      const oldP2 = g.discoveredHexes?.[2] || [];
      if (p1Discovered.length === oldP1.length && p2Discovered.length === oldP2.length) return g;
      return { ...g, discoveredHexes: { 1: p1Discovered, 2: p2Discovered } };
    });
  }, [game.board]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track AI focus hex for camera zoom during AI turn
  const [aiFocusHex, setAiFocusHex] = useState(null);

  // AI turn trigger
  useEffect(() => {
    if (gameMode !== "ai" || game.currentTurn !== 2 || aiRunning || game.winner) return;

    setAiRunning(true);
    showNotification("AI is thinking...");

    const cancel = executeAiTurn(
      game,
      (newState) => setGame(newState),
      addFloatingText,
      showNotification,
      () => { setAiRunning(false); setAiFocusHex(null); },
      setAiFocusHex,
    );
    aiCancelRef.current = cancel;
  }, [gameMode, game.currentTurn, game.phase, game.winner]); // eslint-disable-line react-hooks/exhaustive-deps

  // Valid move targets - only show hexes that can be captured
  const validMoveTargets = useMemo(() => {
    if (mode !== "move" || !selectedHex) return [];
    let myUnits = selectedHex.units.filter(u => u.player === game.currentTurn && !u.attackedThisTurn);
    if (selectedUnitId) myUnits = myUnits.filter(u => u.id === selectedUnitId);
    if (myUnits.length === 0) return [];
    return getNeighbors(selectedHex.q, selectedHex.r).filter(n => {
      const key = hexKey(n.q, n.r);
      const hex = game.board[key];
      if (!hex) return false;
      if (hex.units.some(u => u.player !== game.currentTurn)) return false; // can't move into enemy
      if (hex.units.filter(u => u.player === game.currentTurn).length + myUnits.length > 3) return false;
      // Block movement to uncapturable territory
      if (!hex.owner || hex.owner !== game.currentTurn) {
        // Can't move if enemy building still stands
        if (hex.building && hex.building !== "capital" && hex.owner && hex.owner !== game.currentTurn && hex.buildingHP > 0) return false;
        // Need 2 adjacent owned hexes
        if (countAdjacentOwned(game.board, key, game.currentTurn) < 2) return false;
      }
      return true;
    });
  }, [mode, selectedHex, game.board, game.currentTurn, selectedUnitId]);

  // Valid attack targets - includes hexes with enemy units, capital, or buildings with HP
  const validAttackTargets = useMemo(() => {
    if (mode !== "attack" || !selectedHex) return [];
    let myUnits = selectedHex.units.filter(u => u.player === game.currentTurn && !u.attackedThisTurn && !u.summonedThisTurn);
    if (selectedUnitId) myUnits = myUnits.filter(u => u.id === selectedUnitId);
    if (myUnits.length === 0) return [];
    return getNeighbors(selectedHex.q, selectedHex.r).filter(n => {
      const key = hexKey(n.q, n.r);
      const hex = game.board[key];
      if (!hex) return false;
      const hasEnemyUnits = hex.units.some(u => u.player !== game.currentTurn);
      const hasEnemyCapital = hex.building === "capital" && hex.owner !== game.currentTurn && hex.capitalHP > 0;
      const hasEnemyBuilding = hex.building && hex.building !== "capital" && hex.owner !== game.currentTurn && hex.buildingHP > 0;
      return hasEnemyUnits || hasEnemyCapital || hasEnemyBuilding;
    });
  }, [mode, selectedHex, game.board, game.currentTurn, selectedUnitId]);

  const handleUnitClick = useCallback((hex, unitId) => {
    if (aiRunning) return;
    if (selectedUnitId === unitId) {
      setSelectedUnitId(null);
      return;
    }
    setSelectedUnitId(unitId);
    setSelectedHexKey(hexKey(hex.q, hex.r));
    setMode(null);
    setSelectedCard(null);
  }, [selectedUnitId, aiRunning]);

  const handleHexClick = useCallback((hex) => {
    if (aiRunning) return;
    const key = hexKey(hex.q, hex.r);

    if (mode === "move" && selectedHex) {
      const isValid = validMoveTargets.some(t => hexKey(t.q, t.r) === key);
      if (isValid) {
        const unitIds = selectedUnitId
          ? [selectedUnitId]
          : selectedHex.units
              .filter(u => u.player === game.currentTurn && !u.attackedThisTurn)
              .map(u => u.id);
        const newGame = moveUnits(game, selectedHexKey_, key, unitIds);
        setGame(newGame);
        addFloatingText(hex.q, hex.r, "Moved!", "#90caf9");
        setMode(null);
        setSelectedHexKey(key);
        setSelectedUnitId(null);
        return;
      }
    }

    if (mode === "attack" && selectedHex) {
      const isValid = validAttackTargets.some(t => hexKey(t.q, t.r) === key);
      if (isValid) {
        const targetHex = game.board[key];
        const targetUnit = targetHex.units.find(u => u.player !== game.currentTurn);
        // If no enemy units but building exists, attack the building
        const targetId = targetUnit?.id
          || (targetHex.building === "capital" ? null : null)
          || (targetHex.building && targetHex.building !== "capital" && targetHex.buildingHP > 0 ? "__building__" : null);
        const newGame = attackHex(game, selectedHexKey_, key, targetId || targetUnit?.id, [], selectedUnitId || undefined);
        setGame(newGame);
        // Determine damage feedback
        if (targetUnit) {
          const unitAfter = newGame.board[key].units.find(u => u.id === targetUnit.id);
          if (!unitAfter) {
            addFloatingText(hex.q, hex.r, "Killed!", "#f44336");
          } else {
            const dmg = targetUnit.hp - unitAfter.hp;
            addFloatingText(hex.q, hex.r, dmg > 0 ? `-${dmg} HP` : "Blocked!", dmg > 0 ? "#f44336" : "#888");
          }
        } else if (targetHex.building === "capital" && targetHex.capitalHP > 0) {
          const capAfter = Math.max(0, newGame.board[key].capitalHP);
          const dmg = targetHex.capitalHP - capAfter;
          addFloatingText(hex.q, hex.r, dmg > 0 ? `-${dmg} Capital` : "Blocked!", dmg > 0 ? "#f44336" : "#888");
        } else if (targetHex.building && targetHex.building !== "capital" && targetHex.buildingHP > 0) {
          const bHpAfter = Math.max(0, newGame.board[key].buildingHP);
          const dmg = targetHex.buildingHP - bHpAfter;
          if (bHpAfter <= 0) {
            addFloatingText(hex.q, hex.r, "Building Destroyed!", "#f44336");
          } else {
            addFloatingText(hex.q, hex.r, dmg > 0 ? `-${dmg} Building` : "Blocked!", dmg > 0 ? "#ff9800" : "#888");
          }
        }
        setMode(null);
        setSelectedUnitId(null);
        return;
      }
    }

    if (mode === "playCreature" && selectedCard) {
      if (hex.owner === game.currentTurn) {
        const newGame = playCreature(game, selectedCard.id, key);
        setGame(newGame);
        if (newGame.actionsLeft < game.actionsLeft) {
          showNotification(`Summoned ${selectedCard.name}!`);
          addFloatingText(hex.q, hex.r, selectedCard.name, "#4caf50");
          setMode(null);
          setSelectedCard(null);
        } else {
          const newLogs = newGame.log.slice(game.log.length);
          showNotification(newLogs[newLogs.length - 1] || "Cannot summon here");
        }
        return;
      } else {
        showNotification("Must place creature on your own hex");
        return;
      }
    }

    if (mode === "playBuilding" && selectedCard) {
      if (hex.owner === game.currentTurn && !hex.building) {
        const newGame = playBuilding(game, selectedCard.id, key);
        setGame(newGame);
        if (newGame.actionsLeft < game.actionsLeft) {
          showNotification(`Built ${selectedCard.name}!`);
          addFloatingText(hex.q, hex.r, selectedCard.name, "#42a5f5");
          setMode(null);
          setSelectedCard(null);
        } else {
          const newLogs = newGame.log.slice(game.log.length);
          showNotification(newLogs[newLogs.length - 1] || "Cannot build here");
        }
        return;
      } else if (hex.owner !== game.currentTurn) {
        showNotification("Must place building on your own hex");
        return;
      } else if (hex.building) {
        showNotification("Hex already has a building");
        return;
      }
    }

    if (mode === "playTactical" && selectedCard) {
      if (hex.owner !== game.currentTurn) {
        showNotification("Must target your own hex");
        return;
      }
      const myUnits = hex.units.filter(u => u.player === game.currentTurn);
      if (myUnits.length === 0) {
        showNotification("No units on this hex");
        return;
      }
      if (selectedCard.effect.heal) {
        const damaged = myUnits.filter(u => u.hp < u.maxHp);
        if (damaged.length === 0) {
          showNotification("No damaged units to heal");
          return;
        }
      }
      const newGame = playTactical(game, selectedCard.id, key);
      setGame(newGame);
      if (newGame.actionsLeft < game.actionsLeft) {
        showNotification(`Used ${selectedCard.name}!`);
        addFloatingText(hex.q, hex.r, selectedCard.name, "#ff9800");
        setMode(null);
        setSelectedCard(null);
      } else {
        const newLogs = newGame.log.slice(game.log.length);
        showNotification(newLogs[newLogs.length - 1] || "Cannot use here");
      }
      return;
    }

    setSelectedHexKey(key);
    setMode(null);
    setSelectedCard(null);
    setSelectedUnitId(null);
  }, [mode, selectedHex, selectedHexKey_, validMoveTargets, validAttackTargets, game, selectedCard, selectedUnitId, showNotification, addFloatingText, aiRunning]);

  const handleCardClick = useCallback((card) => {
    if (aiRunning) return;
    if (game.phase !== "action") {
      showNotification("Wait for Action Phase");
      return;
    }
    if (game.actionsLeft < 1) {
      showNotification("No Actions Remaining");
      return;
    }
    if (card.type === "creature") {
      setSelectedCard(card);
      setMode("playCreature");
      showNotification(`Select a hex to summon ${card.name}`);
    } else if (card.type === "building") {
      setSelectedCard(card);
      setMode("playBuilding");
      showNotification(`Select a hex to build ${card.name}`);
    } else if (card.type === "tech") {
      const newGame = playTech(game, card.id);
      setGame(newGame);
      if (newGame.actionsLeft < game.actionsLeft) {
        showNotification(`Researched ${card.name}!`);
      } else {
        const newLogs = newGame.log.slice(game.log.length);
        showNotification(newLogs[newLogs.length - 1] || "Cannot research");
      }
    } else if (card.type === "tactical") {
      setSelectedCard(card);
      setMode("playTactical");
      showNotification(`Select a hex to use ${card.name}`);
    }
  }, [game, showNotification, aiRunning]);

  const handleMoveClick = useCallback(() => {
    if (aiRunning) return;
    if (mode === "move") {
      setMode(null);
      return;
    }
    if (game.actionsLeft < 1) {
      showNotification("No Actions Remaining");
      return;
    }
    if (!selectedHex) {
      showNotification("Select a hex with your units first");
      return;
    }
    let myUnits = selectedHex.units.filter(u => u.player === game.currentTurn && !u.attackedThisTurn);
    if (selectedUnitId) myUnits = myUnits.filter(u => u.id === selectedUnitId);
    if (myUnits.length === 0) {
      showNotification("No units available to move");
      return;
    }
    setMode("move");
  }, [mode, game.actionsLeft, selectedHex, game.currentTurn, selectedUnitId, showNotification, aiRunning]);

  const handleAttackClick = useCallback(() => {
    if (aiRunning) return;
    if (mode === "attack") {
      setMode(null);
      return;
    }
    if (game.actionsLeft < 1) {
      showNotification("No Actions Remaining");
      return;
    }
    if (!selectedHex) {
      showNotification("Select a hex with your units first");
      return;
    }
    let myUnits = selectedHex.units.filter(u => u.player === game.currentTurn && !u.attackedThisTurn && !u.summonedThisTurn);
    if (selectedUnitId) myUnits = myUnits.filter(u => u.id === selectedUnitId);
    if (myUnits.length === 0) {
      showNotification("No units available to attack");
      return;
    }
    setMode("attack");
  }, [mode, game.actionsLeft, selectedHex, game.currentTurn, selectedUnitId, showNotification, aiRunning]);

  const handleStartPhase = useCallback(() => {
    if (aiRunning) return;
    setGame(g => executeStartPhase(g));
  }, [aiRunning]);

  const handleKeepDraw = useCallback((cardId) => {
    setGame(g => keepDrawCard(g, cardId));
  }, []);

  const handleEndTurn = useCallback(() => {
    if (aiRunning) return;
    setGame(g => endTurn(g));
    setSelectedHexKey(null);
    setMode(null);
    setSelectedUnitId(null);
  }, [aiRunning]);

  const handleRestart = useCallback(() => {
    if (aiCancelRef.current) {
      aiCancelRef.current();
      aiCancelRef.current = null;
    }
    setAiRunning(false);
    setGame(freshGame());
    setSelectedHexKey(null);
    setMode(null);
    setSelectedUnitId(null);
    setGameMode(null);
  }, []);

  const hexVisible = selectedHexKey_ ? visibleHexes.has(selectedHexKey_) : false;

  // Show mode select before game starts
  if (gameMode === null) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <ModeSelect onSelect={setGameMode} />
      </ThemeProvider>
    );
  }

  const isAiTurn = gameMode === "ai" && game.currentTurn === 2;

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <PlayerPanel player={game.players[1]} playerNum={1} board={game.board} isActive={game.currentTurn === 1} onCardClick={handleCardClick} />
          <Board
            board={game.board}
            selectedHex={selectedHex}
            validMoveTargets={validMoveTargets}
            validAttackTargets={validAttackTargets}
            visibleHexes={visibleHexes}
            onHexClick={handleHexClick}
            selectedUnitId={selectedUnitId}
            onUnitClick={handleUnitClick}
            currentTurn={game.currentTurn}
            floatingTexts={floatingTexts}
            aiFocusHex={aiFocusHex}
          />
          <PlayerPanel player={game.players[2]} playerNum={2} board={game.board} isActive={game.currentTurn === 2} onCardClick={handleCardClick} hideCards={gameMode === "ai"} />
        </Box>
        <HexInfo hex={selectedHex} visible={hexVisible} />
        <ActionBar
          actionsLeft={game.actionsLeft}
          currentTurn={game.currentTurn}
          turnNumber={game.turnNumber}
          phase={game.phase}
          mode={mode}
          selectedHex={selectedHex}
          notification={notification}
          onMove={handleMoveClick}
          onAttack={handleAttackClick}
          onEndTurn={handleEndTurn}
          onStartPhase={handleStartPhase}
          onCancel={() => { setMode(null); setSelectedCard(null); setSelectedUnitId(null); }}
          aiRunning={aiRunning}
        />
        <GameLog log={game.log} height={logHeight} onResize={setLogHeight} />
      </Box>
      {/* Don't show DrawModal during AI's turn */}
      {!isAiTurn && <DrawModal drawChoices={game.drawChoices} onKeep={handleKeepDraw} />}
      <WinModal winner={game.winner} onRestart={handleRestart} />
    </ThemeProvider>
  );
}
