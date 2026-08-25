import { readFileSync } from 'fs';
const html = readFileSync('C:/Users/user31/Documents/vs/index.html', 'utf8');
const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!m) { console.log('NO MODULE SCRIPT FOUND'); process.exit(1); }
const js = m[1];
const lines = js.split('\n');
console.log('Module script lines:', lines.length);

// collect declared top-level identifiers
const declared = new Set();
for (const line of lines) {
  const t = line.trim();
  let mo;
  if ((mo = t.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/))) declared.add(mo[1]);
  else if ((mo = t.match(/^function\s+([A-Za-z_$][\w$]*)/))) declared.add(mo[1]);
  else if ((mo = t.match(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/))) declared.add(mo[1]);
}
// also catch `const a = ..., b = ...` multi-declarations
for (const line of lines) {
  const t = line.trim();
  const mo = t.match(/^(?:const|let|var)\s+(.+)$/);
  if (mo && !mo[1].includes('(')) {
    for (const part of mo[1].split(',')) {
      const id = part.trim().match(/^([A-Za-z_$][\w$]*)/);
      if (id) declared.add(id[1]);
    }
  }
}

// browser/three globals that are fine
const globals = new Set(['THREE','document','window','console','Math','JSON','Object','Array','Set','Map',
'requestAnimationFrame','addEventListener','removeEventListener','setTimeout','clearTimeout','setInterval',
'devicePixelRatio','performance','location','navigator','history','localStorage','sessionStorage','ResizeObserver',
'PointerEvent','KeyboardEvent','undefined','Infinity','NaN','this','arguments','globalThis']);

// find identifiers used at statement start or after operators that aren't declared
const suspicious = [];
for (let i = 0; i < lines.length; i++) {
  const t = lines[i].replace(/\/\/.*$/, '').trim();
  if (!t || /^(\/\/|\/\*|\*)/.test(t)) continue;
  // identifiers followed by . or ( that look like bare references
  const refs = t.match(/(?<![\w$.'"`])([a-z][\w$]{2,})\s*[.(]/g) || [];
  for (const r of refs) {
    const name = r.replace(/\s*[.(]$/, '');
    if (declared.has(name) || globals.has(name)) continue;
    // local params like e, p, etc are short; skip <=3 chars mostly
    suspicious.push({ line: i + 1, name, code: t.slice(0, 90) });
  }
}
if (suspicious.length === 0) console.log('No suspicious undeclared references found.');
else {
  const seen = new Map();
  for (const s of suspicious) {
    if (!seen.has(s.name)) seen.set(s.name, []);
    seen.get(s.name).push(s);
  }
  for (const [name, occ] of seen) {
    console.log(`\n"${name}" used ${occ.length}x, first at module-line ${occ[0].line}:`);
    console.log('   ', occ[0].code);
  }
}
