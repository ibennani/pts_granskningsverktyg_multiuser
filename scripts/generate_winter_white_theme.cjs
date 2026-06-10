/**
 * Genererar theme-winter-white.css som inverterat tema mot theme-dark-experimental.css.
 * Engångsskript – körs manuellt vid behov av omgenerering.
 */
const fs = require('fs');

const src = fs.readFileSync('css/theme-dark-experimental.css', 'utf8');

/** Källfärg (Midnattsmörker) → målfärg (Vintervitt). */
const color_map = {
    '#fafafa': '#09090b',
    '#09090b': '#fafafa',
    '#e4e4e7': '#1b1b18',
    '#b4b4bc': '#4b4b44',
    '#E6D6BE': '#194141',
    '#707078': '#8f8f87',
    '#94949e': '#6b6b61',
    '#a5b4fc': '#4338ca',
    '#1a1f3a': '#e0e7ff',
    '#fca5a5': '#b91c1c',
    '#2a1518': '#fee2e2',
    '#fcd34d': '#a16207',
    '#2a2210': '#fef9c3',
    '#86efac': '#15803d',
    '#122318': '#dcfce7',
    '#111113': '#eeefed',
    '#1f1f23': '#e0e0dc',
    '#4a5078': '#b5af87',
    '#18181b': '#e7e7e4',
    '#27272a': '#d8d8d5',
    '#6f8f78': '#907087',
    '#183222': '#bbf7d0',
    '#351a1e': '#fecaca',
    '#352a14': '#fde68a',
    '#222848': '#c7d2fe',
    '#fb923c': '#c2410c',
    '#5a6190': '#a59e6f',
    '#141416': '#ebebe9',
    '#3a3f58': '#c5c0a7',
    '#818cf8': '#4f46e5',
    '#76767e': '#898981',
    '#1a3324': '#dcfce7',
    '#3a181c': '#fee2e2',
};

const rgba_map = {
    'rgba(255, 255, 255, 0.05)': 'rgba(0, 0, 0, 0.05)',
    'rgba(0, 0, 0, 0.24)': 'rgba(0, 0, 0, 0.08)',
    'rgba(0, 0, 0, 0.2)': 'rgba(0, 0, 0, 0.06)',
    'rgba(0, 0, 0, 0.25)': 'rgba(0, 0, 0, 0.1)',
    'rgba(0, 0, 0, 0.65)': 'rgba(0, 0, 0, 0.35)',
    'rgba(0, 0, 0, 0.45)': 'rgba(0, 0, 0, 0.12)',
    'rgba(134, 239, 172, 0.08)': 'rgba(21, 128, 61, 0.08)',
    'rgba(252, 165, 165, 0.08)': 'rgba(220, 38, 38, 0.08)',
    'rgba(134, 239, 172, 0.2)': 'rgba(21, 128, 61, 0.2)',
    'rgba(134, 239, 172, 0.35)': 'rgba(21, 128, 61, 0.35)',
    'rgba(252, 165, 165, 0.2)': 'rgba(220, 38, 38, 0.2)',
    'rgba(252, 165, 165, 0.35)': 'rgba(220, 38, 38, 0.35)',
};

function replace_with_placeholders(text, map) {
    const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
    const placeholders = new Map();
    let result = text;
    entries.forEach(([from], index) => {
        const token = `__COLOR_PLACEHOLDER_${index}__`;
        placeholders.set(token, map[from]);
        result = result.split(from).join(token);
    });
    placeholders.forEach((to, token) => {
        result = result.split(token).join(to);
    });
    return result;
}

let out = src
    .replace(/Midnattsmörker/g, 'Vintervitt')
    .replace(/dark-experimental/g, 'winter-white')
    .replace(/mörk design/g, 'ljus design')
    .replace(/mycket mörk yta så vit text syns/g, 'mycket ljus yta så mörk text syns')
    .replace(/ljus text\/symbol mot mörk botten/g, 'mörk text/symbol mot ljus botten')
    .replace(/--de-/g, '--ww-')
    .replace(/var\(--de-/g, 'var(--ww-');

out = out.replace(
    /Tema "Vintervitt" \(winter-white\) – minimalistisk ljus design \(Vercel\/Linear\/Stripe-inspirerad\)\./,
    'Tema "Vintervitt" (winter-white) – minimalistisk ljus design, inverterat mot Midnattsmörker (Vercel/Linear/Stripe-inspirerad).'
);

out = replace_with_placeholders(out, { ...color_map, ...rgba_map });

fs.writeFileSync('css/theme-winter-white.css', out);
console.log('Skapade css/theme-winter-white.css (' + out.split('\n').length + ' rader)');
