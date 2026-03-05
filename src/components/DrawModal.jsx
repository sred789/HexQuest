import { Box, Typography, Modal } from "@mui/material";
import Card from "./Card";

export default function DrawModal({ drawChoices, onKeep }) {
  if (!drawChoices) return null;
  return (
    <Modal open>
      <Box sx={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        bgcolor: "#1a1a2e", border: "2px solid #444", borderRadius: 2, p: 4, textAlign: "center",
      }}>
        <Typography variant="h6" sx={{ color: "#fff", mb: 2 }}>Draw Phase: Keep 1 Card</Typography>
        <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
          {drawChoices.cards.map(card => (
            <Card key={card.id} card={card} onClick={() => onKeep(card.id)} />
          ))}
        </Box>
      </Box>
    </Modal>
  );
}
