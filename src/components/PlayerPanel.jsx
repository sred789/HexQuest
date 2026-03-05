import { Box, Typography, Divider, Chip } from "@mui/material";
import Card from "./Card";
import { getTier, countControlled, countUnits, commandLimit } from "../state/gameActions";

export default function PlayerPanel({ player, playerNum, board, isActive, onCardClick, hideCards }) {
  const color = playerNum === 1 ? "#3c88e0" : "#e04444";
  const controlled = countControlled(board, playerNum);
  const tier = getTier(controlled);
  const units = countUnits(board, playerNum);
  const cmdLimit = commandLimit(board, playerNum);

  return (
    <Box sx={{
      width: 210, minWidth: 210, height: "100%", bgcolor: "#0c0c0c",
      borderLeft: playerNum === 2 ? `3px solid ${color}` : "none",
      borderRight: playerNum === 1 ? `3px solid ${color}` : "none",
      display: "flex", flexDirection: "column", p: 1, overflow: "auto",
    }}>
      <Typography variant="subtitle1" sx={{ color, fontWeight: "bold", textAlign: "center" }}>
        {player.name}
      </Typography>
      {isActive && <Chip label="ACTIVE" size="small" color="success" sx={{ alignSelf: "center", mb: 0.5 }} />}

      <Divider sx={{ my: 0.5, borderColor: "#333" }} />

      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3 }}>
        <Typography variant="caption" sx={{ color: "#ddd" }}>
          Energy: <b style={{ color: "#ffc107" }}>{player.energy}</b> | Knowledge: <b style={{ color: "#8e24aa" }}>{player.knowledge}</b>
        </Typography>
        <Typography variant="caption" sx={{ color: "#ddd" }}>
          Hexes: {controlled} | Tier: {tier}
        </Typography>
        <Typography variant="caption" sx={{ color: "#ddd" }}>
          Units: {units}/{cmdLimit} (cmd)
        </Typography>
        <Typography variant="caption" sx={{ color: "#ddd" }}>
          Deck: {player.deck.length} | Discard: {player.discard.length}
        </Typography>
      </Box>

      {Object.keys(player.techs).length > 0 && (
        <>
          <Divider sx={{ my: 0.5, borderColor: "#333" }} />
          <Typography variant="caption" sx={{ color: "#8e24aa" }}>Techs:</Typography>
          {Object.keys(player.techs).map(t => (
            <Typography key={t} variant="caption" sx={{ color: "#ba68c8", fontSize: "0.6rem" }}>
              {t.replace(/_/g, " ")}
            </Typography>
          ))}
        </>
      )}

      <Divider sx={{ my: 0.5, borderColor: "#333" }} />

      <Typography variant="caption" sx={{ color: "#888" }}>Hand ({player.hand.length}/{player.handLimit})</Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", mt: 0.5, gap: 0.5 }}>
        {hideCards
          ? player.hand.map((_, i) => (
              <Box key={i} sx={{
                width: 50, height: 68, borderRadius: 1,
                bgcolor: "#1a1a2e", border: "1px solid #444",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#666", fontSize: "1.2rem", fontWeight: "bold",
              }}>
                ?
              </Box>
            ))
          : player.hand.map(card => (
              <Card key={card.id} card={card} onClick={onCardClick} disabled={!isActive} small />
            ))
        }
      </Box>
    </Box>
  );
}
