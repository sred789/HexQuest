import { Box, Button, Typography, CircularProgress } from "@mui/material";

export default function ActionBar({ actionsLeft, currentTurn, turnNumber, phase, mode, selectedHex, notification, onMove, onAttack, onEndTurn, onStartPhase, onCancel, aiRunning }) {
  return (
    <Box sx={{ position: "relative" }}>
      {/* Notification toast */}
      {notification && (
        <Box sx={{
          position: "absolute",
          top: -36,
          left: "50%",
          transform: "translateX(-50%)",
          bgcolor: "rgba(30, 30, 50, 0.95)",
          color: "#ffc107",
          px: 2, py: 0.5,
          borderRadius: 1,
          border: "1px solid #ffc107",
          fontSize: "0.8rem",
          fontWeight: "bold",
          whiteSpace: "nowrap",
          zIndex: 1500,
          pointerEvents: "none",
        }}>
          {notification}
        </Box>
      )}

      <Box sx={{
        height: 50, bgcolor: "#0d0d0d", borderTop: "1px solid #333",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5, px: 2,
      }}>
        <Typography variant="body2" sx={{ color: "#aaa", mr: 1 }}>
          Turn {turnNumber}/30 | P{currentTurn} | Actions: {actionsLeft} | {phase === "start" ? "START PHASE" : mode ? `Mode: ${mode}` : "SELECT"}
        </Typography>

        {aiRunning ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={18} sx={{ color: "#e04444" }} />
            <Typography variant="body2" sx={{ color: "#e04444", fontWeight: "bold" }}>AI is thinking...</Typography>
          </Box>
        ) : (
          <>
            {phase === "start" && (
              <Button variant="contained" size="small" color="info" onClick={onStartPhase}>Run Start Phase</Button>
            )}

            {phase === "action" && (
              <>
                <Button variant="contained" size="small" color="primary" onClick={onMove}>
                  {mode === "move" ? "Cancel Move" : "Move"}
                </Button>
                <Button variant="contained" size="small" color="error" onClick={onAttack}>
                  {mode === "attack" ? "Cancel Attack" : "Attack"}
                </Button>
                <Button variant="outlined" size="small" color="warning" onClick={onEndTurn}>End Turn</Button>
              </>
            )}

            {mode && <Button variant="text" size="small" sx={{ color: "#888" }} onClick={onCancel}>Cancel</Button>}
          </>
        )}
      </Box>
    </Box>
  );
}
