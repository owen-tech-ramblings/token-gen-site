function imageId(image) {
  return typeof image?.id === "string" ? image.id : "";
}

export function orderedVisionImages(images, orderedIds, maximum = 4) {
  const available = Array.isArray(images) ? images : [];
  const limit = Math.max(0, Math.trunc(Number(maximum) || 0));
  const byId = new Map(available.map((image) => [imageId(image), image]).filter(([id]) => id));
  const ordered = [];
  const seen = new Set();

  for (const id of Array.isArray(orderedIds) ? orderedIds : []) {
    if (seen.has(id) || !byId.has(id)) continue;
    seen.add(id);
    ordered.push(byId.get(id));
  }
  for (const image of available) {
    const id = imageId(image);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ordered.push(image);
  }
  return ordered.slice(0, limit);
}

export function moveVisionImage(images, id, direction) {
  const next = Array.isArray(images) ? [...images] : [];
  const index = next.findIndex((image) => imageId(image) === id);
  const target = direction === "up" ? index - 1 : direction === "down" ? index + 1 : index;
  if (index < 0 || target < 0 || target >= next.length || target === index) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function selectEditTarget(images, id) {
  return (Array.isArray(images) ? images : []).map((image) => ({
    ...image,
    editTarget: imageId(image) === id,
  }));
}

export function visionContentParts(images) {
  return (Array.isArray(images) ? images : []).flatMap((image, index) => {
    const url = typeof image?.dataUrl === "string" ? image.dataUrl : "";
    if (!url) return [];
    const name = String(image?.name || `Image ${index + 1}`);
    return [
      { type: "text", text: `Image ${index + 1} — ${name}` },
      { type: "image_url", image_url: { url } },
    ];
  });
}
