export async function stageVisionAttachments({
  existing = [],
  files = [],
  limits,
  readVisionImage,
  releasePreview,
}) {
  if (existing.length + files.length > limits.maxImages) {
    throw new Error(`Attach up to ${limits.maxImages} images per message.`);
  }
  const staged = [];
  try {
    for (const file of files) {
      const image = await readVisionImage(file);
      staged.push(image);
      const totalBytes = [...existing, ...staged]
        .reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0);
      if (totalBytes > limits.maxTotalBytes) {
        throw new Error(`Attached images may total up to ${Math.floor(limits.maxTotalBytes / 1024 / 1024)} MB.`);
      }
    }
    return [...existing, ...staged];
  } catch (error) {
    staged.forEach(releasePreview);
    throw error;
  }
}
