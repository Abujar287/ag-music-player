export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function isRemoteVersionNewer(
  remoteTagOrVer: string,
  localVer: string,
  localVersionCode?: number
): boolean {
  const cleanRemote = remoteTagOrVer.replace(/^[Vv]-?/, '').split(/[-+]/)[0].trim();
  const cleanLocal = localVer.replace(/^[Vv]-?/, '').split(/[-+]/)[0].trim();
  const rParts = cleanRemote.split('.').map((n) => parseInt(n, 10) || 0);
  const lParts = cleanLocal.split('.').map((n) => parseInt(n, 10) || 0);
  const max = Math.max(rParts.length, lParts.length);

  let semverNewer = false;
  let semverEqual = true;
  for (let i = 0; i < max; i++) {
    const r = rParts[i] ?? 0;
    const l = lParts[i] ?? 0;
    if (r > l) {
      semverNewer = true;
      semverEqual = false;
      break;
    }
    if (r < l) {
      semverEqual = false;
      return false;
    }
  }

  if (typeof localVersionCode === 'number' && localVersionCode > 0 && rParts.length >= 3) {
    const remoteCode = (rParts[0] ?? 0) * 10000 + (rParts[1] ?? 0) * 100 + (rParts[2] ?? 0);
    if (remoteCode <= localVersionCode) {
      return false;
    }
  }

  return semverNewer && !semverEqual;
}
