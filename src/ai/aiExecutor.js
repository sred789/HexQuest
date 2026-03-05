import { aiChooseDrawCard, aiPlanNextAction } from "./aiPlayer";
import { executeStartPhase, keepDrawCard, moveUnits, attackHex, playCreature, playBuilding, playTech, playTactical, endTurn } from "../state/gameActions";

const DELAY_START = 500;
const DELAY_DRAW = 800;
const DELAY_ACTION_MIN = 800;
const DELAY_ACTION_MAX = 1500;
const DELAY_END = 500;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function actionDelay() {
  return delay(DELAY_ACTION_MIN + Math.random() * (DELAY_ACTION_MAX - DELAY_ACTION_MIN));
}

export function executeAiTurn(game, setGame, addFloatingText, showNotification, onComplete) {
  let cancelled = false;
  let state = JSON.parse(JSON.stringify(game));

  async function run() {
    try {
      // 1. Start phase
      await delay(DELAY_START);
      if (cancelled) return;
      state = executeStartPhase(state);
      setGame(state);

      // 2. Draw phase
      if (state.drawChoices) {
        await delay(DELAY_DRAW);
        if (cancelled) return;
        const cardId = aiChooseDrawCard(state);
        state = keepDrawCard(state, cardId);
        setGame(state);
      }

      // 3. Action loop
      let safety = 0;
      while (state.actionsLeft > 0 && state.phase === "action" && !state.winner && safety < 30) {
        safety++;
        await actionDelay();
        if (cancelled) return;

        const action = aiPlanNextAction(state);
        if (!action || action.type === "endTurn") break;

        const prevState = state;
        state = executeAction(state, action, addFloatingText);

        // Only update if state actually changed
        if (state !== prevState) {
          setGame(state);
        } else {
          break; // action didn't apply, stop
        }
      }

      // 4. End turn
      await delay(DELAY_END);
      if (cancelled) return;
      state = endTurn(state);
      setGame(state);

      if (onComplete) onComplete();
    } catch (err) {
      console.error("AI execution error:", err);
      if (onComplete) onComplete();
    }
  }

  run();

  return () => { cancelled = true; };
}

function executeAction(state, action, addFloatingText) {
  let newState;

  switch (action.type) {
    case "move":
      newState = moveUnits(state, action.from, action.to, action.unitIds);
      if (newState.actionsLeft < state.actionsLeft) {
        const hex = newState.board[action.to];
        if (hex) addFloatingText(hex.q, hex.r, "AI Moved", "#90caf9");
      }
      return newState.actionsLeft < state.actionsLeft ? newState : state;

    case "attack": {
      newState = attackHex(state, action.from, action.to, action.targetUnitId, [], action.attackerUnitId);
      if (newState.actionsLeft < state.actionsLeft) {
        const hex = newState.board[action.to];
        if (hex) {
          // Check if target was killed
          if (action.targetUnitId) {
            const targetStillAlive = hex.units.some(u => u.id === action.targetUnitId);
            if (!targetStillAlive) {
              addFloatingText(hex.q, hex.r, "AI Kill!", "#f44336");
            } else {
              addFloatingText(hex.q, hex.r, "AI Attack", "#ff9800");
            }
          } else {
            addFloatingText(hex.q, hex.r, "AI Siege!", "#f44336");
          }
        }
      }
      return newState.actionsLeft < state.actionsLeft ? newState : state;
    }

    case "playCreature":
      newState = playCreature(state, action.cardId, action.hexKey);
      if (newState.actionsLeft < state.actionsLeft) {
        const hex = newState.board[action.hexKey];
        if (hex) addFloatingText(hex.q, hex.r, "AI Summon", "#4caf50");
      }
      return newState.actionsLeft < state.actionsLeft ? newState : state;

    case "playBuilding":
      newState = playBuilding(state, action.cardId, action.hexKey);
      if (newState.actionsLeft < state.actionsLeft) {
        const hex = newState.board[action.hexKey];
        if (hex) addFloatingText(hex.q, hex.r, "AI Build", "#42a5f5");
      }
      return newState.actionsLeft < state.actionsLeft ? newState : state;

    case "playTech":
      newState = playTech(state, action.cardId);
      if (newState.actionsLeft < state.actionsLeft) {
        // Find what tech was researched from the log
        const lastLog = newState.log[newState.log.length - 1] || "";
        const match = lastLog.match(/researched (.+)/);
        if (match) addFloatingText(0, 0, `AI: ${match[1]}`, "#ba68c8");
      }
      return newState.actionsLeft < state.actionsLeft ? newState : state;

    case "playTactical":
      newState = playTactical(state, action.cardId, action.hexKey);
      if (newState.actionsLeft < state.actionsLeft) {
        const hex = newState.board[action.hexKey];
        if (hex) addFloatingText(hex.q, hex.r, "AI Tactical", "#ff9800");
      }
      return newState.actionsLeft < state.actionsLeft ? newState : state;

    default:
      return state;
  }
}
