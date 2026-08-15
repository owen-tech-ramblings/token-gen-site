export function announceVision(region, message, schedule = queueMicrotask) {
  if (!region || !message) return;
  region.textContent = "";
  schedule(() => { region.textContent = message; });
}
