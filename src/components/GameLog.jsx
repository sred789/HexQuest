import { Box, Typography } from "@mui/material";
import { useEffect, useRef, useCallback } from "react";

export default function GameLog({ log, height = 70, onResize }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [log]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = height;

    const handleMouseMove = (e) => {
      const delta = startY - e.clientY;
      onResize && onResize(Math.max(30, Math.min(400, startHeight + delta)));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [height, onResize]);

  return (
    <Box sx={{ height, minHeight: 30, bgcolor: "#060606", display: "flex", flexDirection: "column" }}>
      {/* Drag handle */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          height: 5,
          minHeight: 5,
          cursor: "row-resize",
          bgcolor: "#222",
          "&:hover": { bgcolor: "#555" },
          transition: "background-color 0.15s",
        }}
      />
      {/* Log entries */}
      <Box sx={{ flex: 1, overflow: "auto", px: 2, py: 0.5 }}>
        {log.slice(-50).map((msg, i) => (
          <Typography key={i} variant="caption" sx={{ color: "#777", lineHeight: 1.2, fontSize: "0.65rem", display: "block" }}>{msg}</Typography>
        ))}
        <div ref={endRef} />
      </Box>
    </Box>
  );
}
