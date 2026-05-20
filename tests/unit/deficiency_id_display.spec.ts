import {
    format_deficiency_id_label,
    should_show_deficiency_id_in_title
} from '../../js/utils/deficiency_id_display.js';

describe('deficiency_id_display', () => {
    const t = (key: string, opts?: Record<string, unknown>) => {
        if (key === 'pass_criterion_deficiency_id_label' && opts?.id) {
            return `Brist-id: ${opts.id}`;
        }
        return key;
    };

    test('format_deficiency_id_label returnerar null utan id', () => {
        expect(format_deficiency_id_label(null, t)).toBeNull();
        expect(format_deficiency_id_label('', t)).toBeNull();
    });

    test('format_deficiency_id_label strippar B-prefix', () => {
        expect(format_deficiency_id_label('B027', t)).toBe('Brist-id: 027');
        expect(format_deficiency_id_label('B7', t)).toBe('Brist-id: 7');
    });

    test('should_show_deficiency_id_in_title kräver låst, failed och id', () => {
        expect(should_show_deficiency_id_in_title(true, 'failed', 'B1')).toBe(true);
        expect(should_show_deficiency_id_in_title(false, 'failed', 'B1')).toBe(false);
        expect(should_show_deficiency_id_in_title(true, 'passed', 'B1')).toBe(false);
        expect(should_show_deficiency_id_in_title(true, 'failed', null)).toBe(false);
    });
});
