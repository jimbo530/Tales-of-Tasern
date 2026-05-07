const fs = require('fs');
const c = fs.readFileSync(__dirname + '/../public/baseling-proto.html', 'utf8');
const m = c.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.log('NO SCRIPT BLOCK'); process.exit(1); }
try { new Function(m[1]); console.log('SYNTAX OK'); }
catch (e) { console.log('SYNTAX ERROR:', e.message); process.exit(1); }
