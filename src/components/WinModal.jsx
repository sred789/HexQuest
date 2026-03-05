import { Box, Typography, Button, Modal } from "@mui/material";

export default function WinModal({ winner, onRestart }) {
  if (!winner) return null;
  return (
    <Modal open>
      <Box sx={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        bgcolor: "#1a1a2e", border: "2px solid gold", borderRadius: 2, p: 4, minWidth: 350, textAlign: "center",
      }}>
        <Typography variant="h4" sx={{ color: "gold", mb: 2 }}>Game Over!</Typography>
        <Typography variant="h5" sx={{ color: "#fff", mb: 3 }}>{winner} Wins!</Typography>
        <Button variant="contained" color="primary" size="large" onClick={onRestart}>Play Again</Button>
      </Box>
    </Modal>
  );
}
