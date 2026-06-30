interface CanvasOverlayProps {
  vectorCount: number;
  zoomLevel: number;
}

export function CanvasOverlay({ vectorCount, zoomLevel }: CanvasOverlayProps) {
  return (
    <div className="absolute bottom-3 right-3 z-10 flex items-center gap-3">
      <span className="text-2xs font-mono text-[#444]">
        {vectorCount} points
      </span>
      <span className="text-2xs font-mono text-[#444]">
        {Math.round(zoomLevel * 100)}%
      </span>
    </div>
  );
}
