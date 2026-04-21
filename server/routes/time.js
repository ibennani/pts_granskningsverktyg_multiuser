import express from 'express';

function pad2(n) {
    return String(n).padStart(2, '0');
}

/**
 * ISO-liknande sträng i serverns lokala tid med offset, t.ex. 2026-04-15T13:45:12+02:00
 */
function format_local_iso_with_offset(date) {
    const d = date instanceof Date ? date : new Date();
    const year = d.getFullYear();
    const month = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    const hour = pad2(d.getHours());
    const minute = pad2(d.getMinutes());
    const second = pad2(d.getSeconds());
    const offset_minutes = -d.getTimezoneOffset();
    const sign = offset_minutes >= 0 ? '+' : '-';
    const abs = Math.abs(offset_minutes);
    const off_h = pad2(Math.floor(abs / 60));
    const off_m = pad2(abs % 60);
    return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${off_h}:${off_m}`;
}

/**
 * Filnamnsvänlig datum+tid i serverns lokala tid: YYYYMMDD_HHMMSS
 */
function format_filename_datetime(date) {
    const d = date instanceof Date ? date : new Date();
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    const ss = pad2(d.getSeconds());
    return `${y}${m}${day}_${hh}${mm}${ss}`;
}

function try_parse_iso(iso) {
    const s = String(iso || '').trim();
    if (!s) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

const router = express.Router();

router.get('/filename-datetime', (req, res) => {
    console.log('[time API] Received filename-datetime request. Query:', req.query);
    const iso = req.query.iso;
    const parsed = try_parse_iso(iso);
    const now = parsed || new Date();
    res.json({
        filename_datetime: format_filename_datetime(now),
        now_local_iso: format_local_iso_with_offset(now)
    });
});

export default router;

