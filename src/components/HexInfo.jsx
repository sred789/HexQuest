import { Box, Typography } from "@mui/material";

export default function HexInfo({ hex, visible }) {
  if (!hex || !visible) return (
    <Box sx={{ height: 50, bgcolor: "#0a0a0a", borderTop: "1px solid #222", px: 2, py: 0.5, display: "flex", alignItems: "center" }}>
      <Typography variant="caption" sx={{ color: "#555" }}>Select a hex to view details</Typography>
    </Box>
  );

  return (
    <Box sx={{ height: 50, bgcolor: "#0a0a0a", borderTop: "1px solid #222", px: 2, py: 0.5, display: "flex", alignItems: "center", gap: 3 }}>
      <Typography variant="caption" sx={{ color: "#aaa" }}>
        ({hex.q},{hex.r}) {hex.terrain} {hex.isObjective ? "\u2605" : ""} | Owner: P{hex.owner || "-"}
        {hex.building ? ` | Building: ${hex.building}` : ""}
        {hex.capitalHP > 0 ? ` | Capital HP: ${hex.capitalHP}/1600` : ""}
        {hex.building && hex.building !== "capital" && hex.buildingHP > 0 ? ` | Building HP: ${hex.buildingHP}` : ""}
      </Typography>
      {hex.units.length > 0 && (
        <Typography variant="caption" sx={{ color: "#ccc" }}>
          Units: {hex.units.map(u => `${u.type}(HP:${u.hp}/${u.maxHp} ATK:${u.atk} P${u.player})`).join(", ")}
        </Typography>
      )}
    </Box>
  );
}
