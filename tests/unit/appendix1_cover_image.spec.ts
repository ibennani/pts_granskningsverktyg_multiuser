import { inject_appendix1_cover_image } from '../../server/services/appendix1_cover_image.ts';

describe('appendix1_cover_image', () => {
    test('inject_appendix1_cover_image ersätter platshållare med data-uri', () => {
        const html = '<img src="{{APPENDIX1_COVER_SRC}}" alt="test">';
        const injected = inject_appendix1_cover_image(html);
        expect(injected).toContain('data:image/jpeg;base64,');
        expect(injected).not.toContain('{{APPENDIX1_COVER_SRC}}');
    });
});
