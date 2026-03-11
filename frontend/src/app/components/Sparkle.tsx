import { motion } from "motion/react";
import { useEffect } from "react";
import { Sparkles } from "lucide-react";

interface SparkleProps {
  id: string;
  x: number;
  y: number;
  onComplete: (id: string) => void;
}

export function Sparkle({ id, x, y, onComplete }: SparkleProps) {
  const colors = [
    "#FFD700",
    "#FFA500",
    "#FF69B4",
    "#87CEEB",
    "#98FB98",
    "#DDA0DD",
    "#F0E68C",
    "#FFB6C1",
  ];

  const color = colors[Math.floor(Math.random() * colors.length)];
  const size = Math.random() * 20 + 10;
  const duration = Math.random() * 0.5 + 0.5;
  const drift = (Math.random() - 0.5) * 100;
  const rotation = Math.random() * 720 - 360;

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete(id);
    }, duration * 1000);
    return () => clearTimeout(timer);
  }, [id, duration, onComplete]);

  return (
    <motion.div
      initial={{
        x: x - size / 2,
        y: y - size / 2,
        opacity: 1,
        scale: 0,
        rotate: 0,
      }}
      animate={{
        y: y - 150,
        x: x + drift,
        opacity: 0,
        scale: [0, 1, 0.8, 0],
        rotate: rotation,
      }}
      transition={{
        duration,
        ease: "easeOut",
      }}
      style={{
        position: "fixed",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      <Sparkles
        size={size}
        color={color}
        fill={color}
        style={{
          filter: "drop-shadow(0 0 6px currentColor)",
        }}
      />
    </motion.div>
  );
}
