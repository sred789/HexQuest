import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { axialToPixel, hexKey } from "../utils/hexUtils";
import { UNIT_DEFS } from "../utils/gameUtils";
import { Box, Typography } from "@mui/material";
import HexTile from "./HexTile";

const HEX_SIZE = 90;

export default function Board({ board, selectedHex, validMoveTargets, validAttackTargets, visibleHexes, onHexClick, selectedUnitId, onUnitClick, currentTurn, floatingTexts }) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const dragging = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [hexTooltip, setHexTooltip] = useState(null);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(z => Math.min(3, Math.max(0.3, z - e.deltaY * 0.002)));
  }, []);

  // Left-click drag for panning
  const handleMouseDown = useCallback((e) => {
    if (e.button === 0 || e.button === 1 || e.button === 2) {
      dragging.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, moved: false };
    }
  }, [pan]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.startX;
    const dy = e.clientY - dragging.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragging.current.moved = true;
    setPan({
      x: dragging.current.panX + dx / zoom,
      y: dragging.current.panY + dy / zoom,
    });
  }, [zoom]);

  const handleMouseUp = useCallback(() => { dragging.current = null; }, []);
  const handleContextMenu = useCallback((e) => e.preventDefault(), []);

  // Wrap hex click to ignore drags
  const handleHexClickWrapped = useCallback((hex) => {
    if (dragging.current && dragging.current.moved) return;
    onHexClick(hex);
  }, [onHexClick]);

  const handleUnitHover = useCallback((unit, e) => {
    const def = UNIT_DEFS[unit.type];
    setTooltip({
      x: e.clientX,
      y: e.clientY,
      unit,
      def,
    });
  }, []);

  const handleUnitLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleHexHover = useCallback((hex, e) => {
    setHexTooltip({
      x: e.clientX,
      y: e.clientY,
      hex,
    });
  }, []);

  const handleHexLeave = useCallback(() => {
    setHexTooltip(null);
  }, []);

  const hexEntries = useMemo(() => Object.values(board), [board]);

  const boardExtents = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const hex of hexEntries) {
      const { x, y } = axialToPixel(hex.q, hex.r, HEX_SIZE);
      if (x - HEX_SIZE < minX) minX = x - HEX_SIZE;
      if (x + HEX_SIZE > maxX) maxX = x + HEX_SIZE;
      if (y - HEX_SIZE < minY) minY = y - HEX_SIZE;
      if (y + HEX_SIZE > maxY) maxY = y + HEX_SIZE;
    }
    return { minX, maxX, minY, maxY };
  }, [hexEntries]);
  const { minX, maxX, minY, maxY } = boardExtents;

  // Wrap unit click to ignore drags
  const handleUnitClickWrapped = useCallback((hex, unitId) => {
    if (dragging.current && dragging.current.moved) return;
    onUnitClick(hex, unitId);
  }, [onUnitClick]);

  // Auto-zoom to current player's visible territory on turn change
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const vbW = maxX - minX + 80;
    const vbH = maxY - minY + 80;
    const vbCx = minX - 40 + vbW / 2;
    const vbCy = minY - 40 + vbH / 2;

    const visEntries = hexEntries.filter(h => visibleHexes.has(hexKey(h.q, h.r)));
    if (visEntries.length === 0) return;

    let vMinX = Infinity, vMaxX = -Infinity, vMinY = Infinity, vMaxY = -Infinity;
    for (const hex of visEntries) {
      const { x, y } = axialToPixel(hex.q, hex.r, HEX_SIZE);
      vMinX = Math.min(vMinX, x - HEX_SIZE * 2);
      vMaxX = Math.max(vMaxX, x + HEX_SIZE * 2);
      vMinY = Math.min(vMinY, y - HEX_SIZE * 2);
      vMaxY = Math.max(vMaxY, y + HEX_SIZE * 2);
    }

    const visW = vMaxX - vMinX;
    const visH = vMaxY - vMinY;
    const visCx = (vMinX + vMaxX) / 2;
    const visCy = (vMinY + vMaxY) / 2;

    const rect = container.getBoundingClientRect();
    const s = Math.min(rect.width / vbW, rect.height / vbH);

    const newZoom = Math.min(
      rect.width / (visW * s),
      rect.height / (visH * s)
    ) * 0.85;

    const panX = -(visCx - vbCx) * s;
    const panY = -(visCy - vbCy) * s;

    setZoom(Math.max(0.3, Math.min(3, newZoom)));
    setPan({ x: panX, y: panY });
  }, [currentTurn]); // eslint-disable-line react-hooks/exhaustive-deps

  const moveSet = new Set(validMoveTargets.map(t => hexKey(t.q, t.r)));
  const attackSet = new Set(validAttackTargets.map(t => hexKey(t.q, t.r)));
  const selKey = selectedHex ? hexKey(selectedHex.q, selectedHex.r) : null;

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: "hidden", background: "#111118", position: "relative", cursor: "grab" }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`${minX - 40} ${minY - 40} ${maxX - minX + 80} ${maxY - minY + 80}`}
        style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, transformOrigin: "center" }}
      >
        {hexEntries.map(hex => {
          const { x, y } = axialToPixel(hex.q, hex.r, HEX_SIZE);
          const key = hexKey(hex.q, hex.r);
          return (
            <HexTile
              key={key}
              hex={hex}
              cx={x}
              cy={y}
              size={HEX_SIZE}
              isSelected={key === selKey}
              isValidTarget={moveSet.has(key)}
              isAttackTarget={attackSet.has(key)}
              visible={visibleHexes.has(key)}
              onClick={handleHexClickWrapped}
              onUnitHover={handleUnitHover}
              onUnitLeave={handleUnitLeave}
              onHexHover={handleHexHover}
              onHexLeave={handleHexLeave}
              selectedUnitId={selectedUnitId}
              onUnitClick={handleUnitClickWrapped}
            />
          );
        })}

        {/* Floating text feedback */}
        {floatingTexts && floatingTexts.map(ft => {
          const { x, y } = axialToPixel(ft.q, ft.r, HEX_SIZE);
          return (
            <text
              key={ft.id}
              x={x}
              y={y - HEX_SIZE * 0.3}
              textAnchor="middle"
              fill={ft.color}
              fontSize={HEX_SIZE * 0.28}
              fontWeight="bold"
              stroke="#000"
              strokeWidth={3}
              paintOrder="stroke"
              style={{ pointerEvents: "none" }}
            >
              {ft.text}
              <animate attributeName="y" from={y - HEX_SIZE * 0.3} to={y - HEX_SIZE * 1.2} dur="1.5s" fill="freeze" />
              <animate attributeName="opacity" from="1" to="0" dur="1.5s" fill="freeze" />
            </text>
          );
        })}
      </svg>

      {/* Creature tooltip */}
      {tooltip && (
        <Box sx={{
          position: "fixed",
          left: tooltip.x + 16,
          top: tooltip.y - 10,
          bgcolor: "rgba(10,10,30,0.95)",
          color: "#fff",
          px: 1.5, py: 1,
          borderRadius: 1,
          border: "1px solid #555",
          pointerEvents: "none",
          zIndex: 2000,
          minWidth: 160,
        }}>
          <Typography sx={{ fontWeight: "bold", fontSize: "0.85rem", color: tooltip.unit.player === 1 ? "#3c88e0" : "#e04444" }}>
            {tooltip.def?.name || tooltip.unit.type} (P{tooltip.unit.player})
          </Typography>
          <Typography sx={{ fontSize: "0.75rem", color: "#ccc" }}>
            Tier {tooltip.unit.tier}
          </Typography>
          <Typography sx={{ fontSize: "0.75rem" }}>
            ATK: <b style={{ color: "#ef5350" }}>{tooltip.unit.atk}</b>
          </Typography>
          <Typography sx={{ fontSize: "0.75rem" }}>
            HP: <b style={{ color: "#4caf50" }}>{tooltip.unit.hp}</b> / {tooltip.unit.maxHp}
          </Typography>
          <Typography sx={{ fontSize: "0.75rem" }}>
            Cost: <b style={{ color: "#ffc107" }}>{tooltip.def?.cost || "?"}E</b>
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5, mt: 0.5 }}>
            {tooltip.unit.attackedThisTurn && <Typography sx={{ fontSize: "0.6rem", color: "#f44336" }}>ATTACKED</Typography>}
            {tooltip.unit.movedThisTurn && <Typography sx={{ fontSize: "0.6rem", color: "#ff9800" }}>MOVED</Typography>}
            {tooltip.unit.summonedThisTurn && <Typography sx={{ fontSize: "0.6rem", color: "#9c27b0" }}>SUMMONED</Typography>}
          </Box>
        </Box>
      )}

      {/* Hex tooltip */}
      {hexTooltip && !tooltip && (
        <Box sx={{
          position: "fixed",
          left: hexTooltip.x + 16,
          top: hexTooltip.y - 10,
          bgcolor: "rgba(10,10,30,0.95)",
          color: "#fff",
          px: 1.5, py: 1,
          borderRadius: 1,
          border: "1px solid #555",
          pointerEvents: "none",
          zIndex: 1999,
          minWidth: 140,
          maxWidth: 220,
        }}>
          <Typography sx={{ fontWeight: "bold", fontSize: "0.8rem" }}>
            {hexTooltip.hex.terrain.charAt(0).toUpperCase() + hexTooltip.hex.terrain.slice(1)} ({hexTooltip.hex.q}, {hexTooltip.hex.r})
          </Typography>
          <Typography sx={{ fontSize: "0.7rem", color: "#aaa" }}>
            Owner: {hexTooltip.hex.owner ? `P${hexTooltip.hex.owner}` : "Neutral"}
          </Typography>
          {hexTooltip.hex.building && (
            <Typography sx={{ fontSize: "0.7rem", color: "#ccc" }}>
              Building: {hexTooltip.hex.building.replace(/_/g, " ")}
              {hexTooltip.hex.building === "capital" && hexTooltip.hex.capitalHP > 0 && ` (${hexTooltip.hex.capitalHP} HP)`}
            </Typography>
          )}
          {hexTooltip.hex.isObjective && (
            <Typography sx={{ fontSize: "0.7rem", color: "gold" }}>
              Objective
            </Typography>
          )}
          {hexTooltip.hex.units.length > 0 && (
            <Box sx={{ mt: 0.5, borderTop: "1px solid #444", pt: 0.5 }}>
              {hexTooltip.hex.units.map(u => (
                <Typography key={u.id} sx={{ fontSize: "0.65rem", color: u.player === 1 ? "#6ab0f3" : "#f07070" }}>
                  {UNIT_DEFS[u.type]?.name || u.type} - HP: {u.hp}/{u.maxHp}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      )}
    </div>
  );
}
