let sequence = 0;

export function nextVisionAnnouncement(message) {
  sequence += 1;
  return `${message}\u2063${sequence}`;
}
