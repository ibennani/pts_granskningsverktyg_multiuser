/**
 * @fileoverview Knappen «Hämta information» i granskningsdelsformuläret (öppnar modal).
 */

export type SampleUrlAnalyzeButtonParts = {
    wrapper: HTMLElement;
    button: HTMLButtonElement;
};

export function create_sample_url_analyze_button(
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    },
    t: (key: string) => string
): SampleUrlAnalyzeButtonParts {
    const button = Helpers.create_element('button', {
        class_name: ['button', 'button-default', 'sample-url-analyze-button'],
        attributes: {
            type: 'button',
            'aria-label': t('sample_url_analyze_button_aria'),
        },
        html_content: `<span class="sample-url-analyze-button__label">${t('sample_url_analyze_button')}</span>`,
    }) as HTMLButtonElement;

    const wrapper = Helpers.create_element('div', {
        class_name: 'sample-url-analyze-button-wrap',
        children: [button],
    });

    return { wrapper, button };
}
