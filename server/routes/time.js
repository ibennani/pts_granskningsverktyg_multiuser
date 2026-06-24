import express from 'express';
import {
    format_filename_datetime_for_download,
    format_local_iso_with_display_timezone_offset,
    parse_iso_to_date,
} from '../../shared/datetime/filename_datetime.js';

const router = express.Router();

router.get('/filename-datetime', (req, res) => {
    console.log('[time API] Received filename-datetime request. Query:', req.query);
    const iso = req.query.iso;
    const now = parse_iso_to_date(iso) || new Date();
    res.json({
        filename_datetime: format_filename_datetime_for_download(now),
        now_local_iso: format_local_iso_with_display_timezone_offset(now)
    });
});

export default router;

