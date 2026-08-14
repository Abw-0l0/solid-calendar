/**
 * ColorUtils — Color manipulation for calendar events
 */

const COLOR_PALETTE = [
    { light: '#D6B6F6', dark: '#8935FF' },
    { light: '#FFE8DC', dark: '#FFAD81' },
    { light: '#DCF6FF', dark: '#007CBE' },
    { light: '#EDFFDC', dark: '#76CA27' },
    { light: '#FFD6D6', dark: '#E53E3E' },
    { light: '#FFF3D6', dark: '#D69E2E' },
    { light: '#D6FFE8', dark: '#38A169' },
    { light: '#E8D6FF', dark: '#805AD5' }
];

export function getColorForId(id) {
    const index = typeof id === 'string' ? hashString(id) : Math.abs(Number(id));
    return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

export function hexToRgb(hex) {
    const cleaned = hex.replace('#', '');
    if (cleaned.length === 3) {
        return {
            r: parseInt(cleaned[0] + cleaned[0], 16),
            g: parseInt(cleaned[1] + cleaned[1], 16),
            b: parseInt(cleaned[2] + cleaned[2], 16)
        };
    }
    if (cleaned.length === 6) {
        return {
            r: parseInt(cleaned.substring(0, 2), 16),
            g: parseInt(cleaned.substring(2, 4), 16),
            b: parseInt(cleaned.substring(4, 6), 16)
        };
    }
    return null;
}

export function lightenColor(hex, amount = 0.85) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const r = Math.round(rgb.r + (255 - rgb.r) * amount);
    const g = Math.round(rgb.g + (255 - rgb.g) * amount);
    const b = Math.round(rgb.b + (255 - rgb.b) * amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function getContrastTextColor(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return '#000000';
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

const GROUP_COLORS = [
    '#E53E3E', '#DD6B20', '#D69E2E', '#38A169', '#3182CE',
    '#805AD5', '#D53F8C', '#00B5D8', '#319795', '#718096',
];

export function getGroupColor(groupId) {
    if (!groupId) return null;
    return GROUP_COLORS[hashString(String(groupId)) % GROUP_COLORS.length];
}

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

export default { getColorForId, hexToRgb, lightenColor, getContrastTextColor, getGroupColor };
