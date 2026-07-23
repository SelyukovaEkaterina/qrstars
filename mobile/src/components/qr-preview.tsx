import { useMemo } from "react";
import { Canvas, Group, Picture } from "@shopify/react-native-skia";

import type { QRTemplateConfig } from "@/qr/types";
import { buildQRPicture } from "@/qr/render";

interface QRPreviewProps {
  config: QRTemplateConfig;
  payload: string;
  maxWidth?: number;
}

export function QRPreview({ config, payload, maxWidth = 300 }: QRPreviewProps) {
  const result = useMemo(() => {
    const effectivePayload = payload || "https://qrstars.ru";
    return buildQRPicture(config, effectivePayload);
  }, [config, payload]);

  const scale = Math.min(maxWidth / result.width, maxWidth / result.height);
  const displayW = result.width * scale;
  const displayH = result.height * scale;

  return (
    <Canvas style={{ width: displayW, height: displayH }}>
      <Group transform={[{ scale }]}>
        <Picture picture={result.picture} />
      </Group>
    </Canvas>
  );
}
