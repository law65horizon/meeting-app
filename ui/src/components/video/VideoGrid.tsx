/**
 * VideoGrid.tsx
 *
 * Responsive video grid that uses CSS Grid auto-placement (no hardcoded
 * grid-template-areas per count). Supports grid, focus and presentation
 * layouts. Overflow strip on the right (desktop) or bottom (mobile).
 */
import { useState, useMemo } from "react";
import { Box, useTheme, useMediaQuery } from "@mui/material";
import ParticipantVideo from "./ParticipantVideo";
import { Participant } from "../../types";

interface VideoGridProps {
  participants: Participant[];
  layout: "grid" | "focus" | "presentation";
  screenShareParticipantId?: string;
  streams: { [peerId: string]: MediaStream };
}

/** How many columns to use for N participants on each breakpoint. */
function colCount(n: number, isDesktop: boolean, isTablet: boolean): number {
  if (isDesktop) {
    if (n <= 1) return 1;
    if (n <= 4) return 2;
    if (n <= 9) return 3;
    return 4;
  }
  if (isTablet) {
    if (n <= 1) return 1;
    if (n <= 4) return 2;
    return 3;
  }
  // mobile
  return n === 1 ? 1 : 2;
}

const STRIP_W = 200; // desktop side strip width (px)
const STRIP_H = 120; // mobile bottom strip height (px)

const VideoGrid = ({
  participants,
  layout,
  screenShareParticipantId,
  streams,
}: VideoGridProps) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const isTablet = useMediaQuery(theme.breakpoints.between("md", "lg"));
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [focusedId, setFocusedId] = useState<string | null>(null);

  const localParticipant = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return participants.find((p) => p.id === u.id) ?? participants[0];
    } catch {
      return participants[0];
    }
  }, [participants]);

  const { main, strip } = useMemo(() => {
    const MAX = isDesktop ? 12 : isTablet ? 9 : 6;
    let main: Participant[] = [];
    let strip: Participant[] = [];

    if (layout === "presentation" && screenShareParticipantId) {
      const sharer = participants.find((p) => p.id === screenShareParticipantId);
      main = sharer ? [sharer] : participants.slice(0, MAX);
      strip = participants.filter((p) => p.id !== screenShareParticipantId);
    } else if (layout === "focus" && focusedId) {
      const focused = participants.find((p) => p.id === focusedId);
      main = focused ? [focused] : participants.slice(0, MAX);
      strip = participants.filter((p) => p.id !== focusedId);
    } else {
      main = participants.slice(0, MAX);
      strip = participants.slice(MAX);
    }

    return { main, strip };
  }, [participants, layout, screenShareParticipantId, focusedId, isDesktop, isTablet]);

  // ── Key mismatch diagnostic ──────────────────────────────────────────────
  // If streams[p.id] is undefined for a participant, the peerId used in
  // App.tsx upsertTrack() doesn't match participant.id from Firestore.
  // Check the [newProducer] log: appData.peerId must equal participant.id.
  const streamKeys = Object.keys(streams);
  const participantIds = participants.map((p) => p.id);
  const unmapped = participantIds.filter((id) => !streams[id]);
  if (unmapped.length > 0 && streamKeys.length > 0) {
    console.warn(
      "%c[VideoGrid] STREAM KEY MISMATCH — participants with no stream:",
      "color:#f87171; font-weight:bold",
      unmapped,
      "\nStream keys available:", streamKeys,
      "\nFix: appData.peerId in App.tsx must equal participant.id in Firestore"
    );
  }

  const cols = colCount(main.length, isDesktop, isTablet);
  const hasStrip = strip.length > 0;

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        bgcolor: "#0a0a0f",
        overflow: "hidden",
      }}
    >
      {/* ── Main Grid ── */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          right: !isMobile && hasStrip ? `${STRIP_W + 8}px` : 0,
          bottom: isMobile && hasStrip ? `${STRIP_H + 8}px` : 0,
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridAutoRows: "1fr",
          gap: { xs: "4px", sm: "6px" },
          p: { xs: "4px", sm: "8px" },
          boxSizing: "border-box",
        }}
      >
        {main.map((p) => (
          <Box
            key={p.id}
            onClick={() => layout === "grid" && setFocusedId(p.id === focusedId ? null : p.id)}
            sx={{
              borderRadius: "10px",
              overflow: "hidden",
              cursor: layout === "grid" ? "pointer" : "default",
              outline: p.id === focusedId ? "2px solid #6ee7b7" : "none",
              outlineOffset: "-2px",
              position: "relative",
              transition: "outline 0.15s",
            }}
          >
            <ParticipantVideo
              participant={p}
              isLocal={p.id === localParticipant?.id}
              isFocused={p.id === focusedId}
              onClick={() => {}}
              stream={streams[p.id]}
            />
          </Box>
        ))}
      </Box>

      {/* ── Side strip (desktop/tablet) ── */}
      {!isMobile && hasStrip && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            right: 0,
            width: `${STRIP_W}px`,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            p: "8px",
            overflowY: "auto",
            bgcolor: "rgba(0,0,0,0.3)",
            borderLeft: "1px solid rgba(255,255,255,0.05)",
            boxSizing: "border-box",
          }}
        >
          {strip.map((p) => (
            <Box
              key={p.id}
              onClick={() => setFocusedId(p.id)}
              sx={{
                flexShrink: 0,
                height: 120,
                borderRadius: "8px",
                overflow: "hidden",
                cursor: "pointer",
                "&:hover": { outline: "2px solid rgba(110,231,183,0.4)" },
              }}
            >
              <ParticipantVideo
                participant={p}
                isLocal={p.id === localParticipant?.id}
                height="100%"
                width="100%"
              />
            </Box>
          ))}
        </Box>
      )}

      {/* ── Bottom strip (mobile) ── */}
      {isMobile && hasStrip && (
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: `${STRIP_H}px`,
            display: "flex",
            flexDirection: "row",
            gap: "6px",
            p: "6px",
            overflowX: "auto",
            bgcolor: "rgba(0,0,0,0.4)",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            boxSizing: "border-box",
          }}
        >
          {strip.map((p) => (
            <Box
              key={p.id}
              onClick={() => setFocusedId(p.id)}
              sx={{
                flexShrink: 0,
                width: 90,
                borderRadius: "8px",
                overflow: "hidden",
                cursor: "pointer",
              }}
            >
              <ParticipantVideo
                participant={p}
                isLocal={p.id === localParticipant?.id}
                height="100%"
                width="100%"
              />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default VideoGrid;