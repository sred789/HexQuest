import { Box, Button, Typography } from "@mui/material";

export default function ModeSelect({ onSelect }) {
  return (
    <Box sx={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "100vh", bgcolor: "#0a0a14", gap: 3,
    }}>
      <Typography variant="h2" sx={{ color: "#e0e0e0", fontWeight: "bold", letterSpacing: 4, mb: 1 }}>
        HexQuest
      </Typography>
      <Typography variant="subtitle1" sx={{ color: "#888", mb: 4 }}>
        Choose your game mode
      </Typography>
      <Box sx={{ display: "flex", gap: 3 }}>
        <Button
          variant="contained"
          size="large"
          onClick={() => onSelect("human")}
          sx={{ px: 5, py: 2, fontSize: "1.1rem", bgcolor: "#3c88e0", "&:hover": { bgcolor: "#5a9ef0" } }}
        >
          vs Human
        </Button>
        <Button
          variant="contained"
          size="large"
          onClick={() => onSelect("ai")}
          sx={{ px: 5, py: 2, fontSize: "1.1rem", bgcolor: "#e04444", "&:hover": { bgcolor: "#f06060" } }}
        >
          vs AI
        </Button>
      </Box>
    </Box>
  );
}
