// Builds dist/artifact.html: a single-file version of the app for hosts that
// take one HTML fragment (no <html>/<head>/<body>), such as Claude artifacts.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const html = read('index.html');
let body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
body = body.replace(/<script src="[^"]+"><\/script>\s*/g, '');

const out = `<title>Guitar Flash Metronome</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${read('styles.css')}
</style>
${body.trim()}
<script>
${read('chords.js')}
</script>
<script>
${read('app.js')}
</script>
`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'artifact.html'), out);
console.log('wrote dist/artifact.html', out.length, 'bytes');
