// Builds the web bundle used by the desktop (Electron) app.
//
// Why a mirror? The repository lives inside OneDrive, and OneDrive keeps
// newly installed packages as cloud placeholders. Metro cannot read those,
// so a fresh `expo export` from the OneDrive folder fails with
// "Unable to resolve module expo-haptics" (or similar).
//
// C:\pp is the clean local mirror used for the Android builds, so we export
// from there and write the result straight into desktop/web.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..');
const mirror = process.env.SLATI_MIRROR || 'C:\\pp';
const outDir = path.join(desktopDir, 'web');

const workDir = fs.existsSync(path.join(mirror, 'App.js')) ? mirror : repoRoot;
console.log('[slati] exporting web from ' + workDir);

// Run the Expo CLI through node directly: spawning npx.cmd fails with EINVAL
// on Windows and avoids quoting problems with paths that contain spaces.
const cli = path.join(workDir, 'node_modules', 'expo', 'bin', 'cli');
if (!fs.existsSync(cli)) {
  console.error('[slati] expo CLI not found at ' + cli + ' — run npm install first');
  process.exit(1);
}

execFileSync(
  process.execPath,
  [cli, 'export', '-p', 'web', '--output-dir', outDir, '--clear'],
  { cwd: workDir, stdio: 'inherit' }
);

const index = path.join(outDir, 'index.html');
if (!fs.existsSync(index)) {
  console.error('[slati] export finished but ' + index + ' is missing');
  process.exit(1);
}
console.log('[slati] web export ready -> ' + outDir);
