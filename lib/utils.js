const fs = require('fs');

function readJsonSafe(filePath, defaultValue = {}) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const txt = fs.readFileSync(filePath, 'utf8');
    if (!txt || !txt.trim()) return defaultValue;
    return JSON.parse(txt);
  } catch (e) {
    try { fs.copyFileSync(filePath, `${filePath}.corrupt.${Date.now()}`); } catch (_) {}
    try { fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8'); } catch (_) {}
    return defaultValue;
  }
}

function writeJsonAtomic(filePath, obj) {
  const tmp = `${filePath}.tmp.${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

module.exports = { readJsonSafe, writeJsonAtomic };
