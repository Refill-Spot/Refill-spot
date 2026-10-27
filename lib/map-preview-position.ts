/** Keep the preview beside its marker, flipping left at the right edge. */
export function getMapPreviewPosition(
  marker: { x: number; y: number },
  viewport: { width: number; height: number },
  card: { width: number; height: number },
) {
  const inset = 12;
  const gap = 24;
  const preferredLeft =
    marker.x + gap + card.width <= viewport.width - inset
      ? marker.x + gap
      : marker.x - gap - card.width;
  return {
    left: Math.max(
      inset,
      Math.min(preferredLeft, viewport.width - card.width - inset),
    ),
    top: Math.max(
      inset,
      Math.min(marker.y - 42, viewport.height - card.height - inset),
    ),
  };
}
