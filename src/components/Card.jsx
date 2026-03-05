import { useState } from "react";
import { Box, Typography } from "@mui/material";
import { UNIT_DEFS } from "../utils/gameUtils";

const TYPE_COLORS = {
  creature: "#2e7d32", building: "#1565c0", tech: "#6a1b9a", tactical: "#c62828",
};

const CREATURE_EMOJI = {
  scout: "\u2604\ufe0f", warrior: "\u2694\ufe0f", archer: "\ud83c\udff9", knight: "\u265e",
  mage: "\u2728", catapult: "\ud83d\udca3", dragon: "\ud83d\udc09", titan: "\ud83d\uddff",
};

export default function Card({ card, onClick, disabled, small, selected }) {
  const [hover, setHover] = useState(false);
  const w = small ? 95 : 120;
  const h = small ? 70 : 90;
  const isCreature = card.type === "creature";
  const def = isCreature ? UNIT_DEFS[card.unitKey] : null;

  return (
    <Box
      onClick={() => !disabled && onClick && onClick(card)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      sx={{
        width: w, minHeight: h, position: "relative",
        border: selected ? "2px solid #ff0" : "2px solid",
        borderColor: selected ? "#ff0" : (TYPE_COLORS[card.type] || "#555"),
        borderRadius: 1, p: 0.5, bgcolor: disabled ? "#222" : "#1a1a1a",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        "&:hover": disabled ? {} : { borderColor: "#fff", transform: "translateY(-3px)", boxShadow: "0 4px 12px rgba(0,0,0,0.5)" },
        transition: "all 0.15s",
        display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
      }}
    >
      {isCreature && (
        <Typography sx={{ fontSize: small ? "1.1rem" : "1.4rem", lineHeight: 1 }}>
          {CREATURE_EMOJI[card.unitKey] || "\u25cf"}
        </Typography>
      )}
      <Typography sx={{ color: TYPE_COLORS[card.type], fontWeight: "bold", fontSize: "0.5rem" }}>
        {card.type.toUpperCase()}
      </Typography>
      <Typography sx={{ color: "#fff", fontWeight: "bold", fontSize: small ? "0.6rem" : "0.7rem", textAlign: "center" }}>
        {card.name}
      </Typography>
      <Typography sx={{ color: "#aaa", fontSize: "0.5rem", textAlign: "center" }}>
        {card.cost ? `${card.cost}E` : card.knCost ? `${card.knCost}K` : ""}
      </Typography>

      {/* Hover detail popup */}
      {hover && !disabled && (
        <Box sx={{
          position: "absolute",
          bottom: "105%", left: "50%", transform: "translateX(-50%)",
          bgcolor: "rgba(10,10,30,0.95)", border: "1px solid #555",
          borderRadius: 1, px: 1.5, py: 1, zIndex: 3000,
          minWidth: 150, pointerEvents: "none",
        }}>
          <Typography sx={{ fontWeight: "bold", fontSize: "0.8rem", color: "#fff" }}>{card.name}</Typography>
          <Typography sx={{ fontSize: "0.7rem", color: TYPE_COLORS[card.type] }}>{card.type.toUpperCase()}</Typography>
          {isCreature && def && (
            <>
              <Typography sx={{ fontSize: "0.7rem", color: "#ccc" }}>Tier {def.tier}</Typography>
              <Typography sx={{ fontSize: "0.7rem" }}>ATK: <b style={{ color: "#ef5350" }}>{def.atk}</b></Typography>
              <Typography sx={{ fontSize: "0.7rem" }}>HP: <b style={{ color: "#4caf50" }}>{def.hp}</b></Typography>
              <Typography sx={{ fontSize: "0.7rem" }}>Cost: <b style={{ color: "#ffc107" }}>{def.cost}E</b></Typography>
            </>
          )}
          {!isCreature && (
            <Typography sx={{ fontSize: "0.65rem", color: "#aaa" }}>{card.description}</Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
