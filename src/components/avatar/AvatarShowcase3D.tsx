import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AvatarConfig } from "@/context/UserContext";
import { AvatarSVG, DEFAULT_AVATAR_CONFIG, type FullAvatarConfig } from "./SVGAvatarParts";
import AvatarRenderer from "./AvatarRenderer";
import { cn } from "@/lib/utils";

interface AvatarShowcase3DProps {
  avatar?: string;
  avatarConfig?: AvatarConfig | FullAvatarConfig | null;
  size?: number;
  className?: string;
  autoRotate?: boolean;
}

const AvatarShowcase3D: React.FC<AvatarShowcase3DProps> = ({
  avatar,
  avatarConfig,
  size = 220,
  className,
  autoRotate = true,
}) => {
  const [dragRotate, setDragRotate] = useState(0);

  const resolvedConfig = useMemo<FullAvatarConfig | null>(() => {
    if (!avatarConfig || typeof avatarConfig !== "object") return null;

    const merged: FullAvatarConfig = {
      ...DEFAULT_AVATAR_CONFIG,
      skinTone: (avatarConfig as any).skinTone ?? DEFAULT_AVATAR_CONFIG.skinTone,
      faceShape: (avatarConfig as any).faceShape ?? DEFAULT_AVATAR_CONFIG.faceShape,
      hairStyle: (avatarConfig as any).hairStyle ?? DEFAULT_AVATAR_CONFIG.hairStyle,
      hairColor: (avatarConfig as any).hairColor ?? DEFAULT_AVATAR_CONFIG.hairColor,
      eyeType: (avatarConfig as any).eyeType ?? DEFAULT_AVATAR_CONFIG.eyeType,
      eyeColor: (avatarConfig as any).eyeColor ?? DEFAULT_AVATAR_CONFIG.eyeColor,
      eyebrowType: (avatarConfig as any).eyebrowType ?? DEFAULT_AVATAR_CONFIG.eyebrowType,
      noseType: (avatarConfig as any).noseType ?? DEFAULT_AVATAR_CONFIG.noseType,
      mouthType: (avatarConfig as any).mouthType ?? DEFAULT_AVATAR_CONFIG.mouthType,
      facialHair: (avatarConfig as any).facialHair ?? DEFAULT_AVATAR_CONFIG.facialHair,
      accessory: (avatarConfig as any).accessory ?? DEFAULT_AVATAR_CONFIG.accessory,
      outfit: (avatarConfig as any).outfit ?? DEFAULT_AVATAR_CONFIG.outfit,
      outfitColor: (avatarConfig as any).outfitColor ?? DEFAULT_AVATAR_CONFIG.outfitColor,
      background: (avatarConfig as any).background ?? DEFAULT_AVATAR_CONFIG.background,
    };

    return merged;
  }, [avatarConfig]);

  return (
    <div className={cn("relative flex flex-col items-center justify-center", className)} style={{ perspective: 1200 }}>
      <motion.div
        className="relative"
        animate={autoRotate ? { rotateY: [dragRotate, dragRotate + 360] } : { rotateY: dragRotate }}
        transition={autoRotate ? { duration: 18, ease: "linear", repeat: Infinity } : undefined}
        drag="x"
        dragElastic={0.08}
        dragConstraints={{ left: 0, right: 0 }}
        onDrag={(_, info) => setDragRotate((prev) => prev + info.delta.x * 0.7)}
        style={{ transformStyle: "preserve-3d", filter: "drop-shadow(0 20px 25px rgba(0,0,0,0.25))" }}
      >
        <motion.div style={{ transform: "translateZ(30px)" }}>
          {resolvedConfig ? (
            <AvatarSVG config={resolvedConfig} size={size} />
          ) : (
            <AvatarRenderer avatar={avatar} size="xl" className="h-56 w-56 text-8xl ring-4 ring-primary/30" />
          )}
        </motion.div>
      </motion.div>
      <p className="mt-3 text-xs text-muted-foreground">Drag to rotate</p>
    </div>
  );
};

export default AvatarShowcase3D;
