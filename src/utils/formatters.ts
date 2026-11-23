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

export function isRemoteVersionNewer(remoteTagOrVer: string, localVer: string): boolean {
  const cleanRemote = remoteTagOrVer.replace(/^[Vv]-?/, '').trim();
  const cleanLocal = localVer.replace(/^[Vv]-?/, '').trim();
  const rParts = cleanRemote.split('.').map((n) => parseInt(n, 10) || 0);
  const lParts = cleanLocal.split('.').map((n) => parseInt(n, 10) || 0);
  const max = Math.max(rParts.length, lParts.length);
  for (let i = 0; i < max; i++) {
    const r = rParts[i] ?? 0;
    const l = lParts[i] ?? 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}
