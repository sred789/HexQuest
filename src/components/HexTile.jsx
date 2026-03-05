import { hexPointsString } from "../utils/hexUtils";
import { TERRAIN_COLORS, UNIT_DEFS } from "../utils/gameUtils";

const CREATURE_EMOJI = {
  scout: "\u2604\ufe0f", warrior: "\u2694\ufe0f", archer: "\ud83c\udff9", knight: "\u265e",
  mage: "\u2728", catapult: "\ud83d\udca3", dragon: "\ud83d\udc09", titan: "\ud83d\uddff",
};

const BUILDING_ICONS = {
  capital: "\ud83c\udff0",
  fortification: "\ud83d\udee1\ufe0f",
  energy_structure: "\u26a1",
  knowledge_structure: "\ud83d\udcda",
  healing_structure: "\u2764\ufe0f",
};

const PLAYER_COLORS = { 1: "#3c88e0", 2: "#e04444" };

function ownerOverlay(hex, visible) {
  if (!visible) return null;
  if (hex.owner === 1) return "rgba(60, 130, 220, 0.3)";
  if (hex.owner === 2) return "rgba(220, 60, 60, 0.3)";
  return null;
}

function ownerStroke(hex, isSelected, isAttackTarget, isValidTarget, visible) {
  if (isSelected) return "#ff0";
  if (isAttackTarget) return "#f00";
  if (isValidTarget) return "#0f0";
  if (!visible) return "#333";
  if (hex.owner === 1) return PLAYER_COLORS[1];
  if (hex.owner === 2) return PLAYER_COLORS[2];
  return "#444";
}

function ownerStrokeWidth(hex, isSelected, isAttackTarget, isValidTarget, visible) {
  if (isSelected || isValidTarget || isAttackTarget) return 4;
  if (!visible) return 2;
  if (hex.owner) return 3;
  return 2;
}

export default function HexTile({ hex, cx, cy, size, isSelected, isValidTarget, isAttackTarget, visible, onClick, onUnitHover, onUnitLeave, onHexHover, onHexLeave, selectedUnitId, onUnitClick }) {
  const points = hexPointsString(cx, cy, size);
  const terrainBg = visible ? TERRAIN_COLORS[hex.terrain] : "#2a2a2a";
  const overlay = ownerOverlay(hex, visible);
  const stroke = ownerStroke(hex, isSelected, isAttackTarget, isValidTarget, visible);
  const strokeWidth = ownerStrokeWidth(hex, isSelected, isAttackTarget, isValidTarget, visible);

  const unitSlots = hex.units.slice(0, 3);

  return (
    <g
      onClick={() => onClick(hex)}
      onMouseEnter={(e) => onHexHover && onHexHover(hex, e)}
      onMouseLeave={() => onHexLeave && onHexLeave()}
      style={{ cursor: "pointer" }}
    >
      {/* Terrain base */}
      <polygon points={points} fill={terrainBg} stroke={stroke} strokeWidth={strokeWidth} />
      {/* Owner tint overlay */}
      {overlay && <polygon points={points} fill={overlay} stroke="none" />}

      {/* Selected hex glow */}
      {isSelected && (
        <polygon
          points={points}
          fill="rgba(255, 255, 0, 0.15)"
          stroke="none"
        >
          <animate attributeName="fill" values="rgba(255,255,0,0.1);rgba(255,255,0,0.25);rgba(255,255,0,0.1)" dur="1.5s" repeatCount="indefinite" />
        </polygon>
      )}

      {!visible && (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={size * 0.4} fill="#555">?</text>
      )}

      {/* Terrain label */}
      {visible && (
        <text x={cx} y={cy - size * 0.55} textAnchor="middle" fontSize={size * 0.16} fill="rgba(255,255,255,0.6)" fontWeight="bold">
          {hex.terrain.toUpperCase()}
        </text>
      )}

      {/* Objective star */}
      {visible && hex.isObjective && (
        <text x={cx + size * 0.45} y={cy - size * 0.45} textAnchor="middle" fontSize={size * 0.25} fill="gold">{"\u2605"}</text>
      )}

      {/* Building icon */}
      {visible && hex.building && (
        <text x={cx} y={cy - size * 0.25} textAnchor="middle" dominantBaseline="central" fontSize={size * 0.35}>
          {BUILDING_ICONS[hex.building] || "\ud83c\udfd7\ufe0f"}
        </text>
      )}

      {/* Capital HP bar */}
      {visible && hex.building === "capital" && hex.capitalHP > 0 && (
        <>
          <rect x={cx - size * 0.4} y={cy + size * 0.55} width={size * 0.8} height={size * 0.08} fill="#333" rx={1} />
          <rect x={cx - size * 0.4} y={cy + size * 0.55} width={size * 0.8 * (hex.capitalHP / 1600)} height={size * 0.08} fill="#4caf50" rx={1} />
        </>
      )}

      {/* Unit emoji sprites */}
      {visible && unitSlots.map((unit, i) => {
        const emoji = CREATURE_EMOJI[unit.type];
        if (!emoji) return null;
        const offsetX = (i - (unitSlots.length - 1) / 2) * size * 0.4;
        const uy = cy + size * 0.05;
        const ux = cx + offsetX;
        const hpPct = unit.hp / unit.maxHp;
        const playerColor = PLAYER_COLORS[unit.player] || "#fff";
        const def = UNIT_DEFS[unit.type];
        const name = def?.name || unit.type;

        return (
          <g
            key={unit.id}
            onMouseEnter={(e) => onUnitHover && onUnitHover(unit, e)}
            onMouseLeave={() => onUnitLeave && onUnitLeave()}
          >
            {/* Selected unit glow */}
            {unit.id === selectedUnitId && (
              <rect
                x={ux - size * 0.2}
                y={uy - size * 0.2}
                width={size * 0.4}
                height={size * 0.54}
                fill="none"
                stroke="#ff0"
                strokeWidth={2}
                rx={3}
              >
                <animate attributeName="stroke-opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
              </rect>
            )}
            {/* Invisible hit area for easier clicking */}
            <rect
              x={ux - size * 0.18}
              y={uy - size * 0.18}
              width={size * 0.36}
              height={size * 0.5}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                onUnitClick && onUnitClick(hex, unit.id);
              }}
            />
            {/* Unit emoji */}
            <text
              x={ux}
              y={uy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={size * 0.35}
              style={{ pointerEvents: "none" }}
            >
              {emoji}
            </text>
            {/* Unit name */}
            <text
              x={ux}
              y={uy + size * 0.2}
              textAnchor="middle"
              fontSize={size * 0.11}
              fill={playerColor}
              fontWeight="bold"
              style={{ pointerEvents: "none" }}
            >
              {name}
            </text>
            {/* HP bar */}
            <rect x={ux - size * 0.15} y={uy + size * 0.27} width={size * 0.3} height={size * 0.05} fill="#333" rx={1} />
            <rect x={ux - size * 0.15} y={uy + size * 0.27} width={size * 0.3 * hpPct} height={size * 0.05} fill={hpPct > 0.5 ? "#4caf50" : hpPct > 0.25 ? "#ff9800" : "#f44336"} rx={1} />
            {/* Player dot */}
            <circle cx={ux + size * 0.15} cy={uy - size * 0.15} r={size * 0.04} fill={playerColor} />
          </g>
        );
      })}
    </g>
  );
}
