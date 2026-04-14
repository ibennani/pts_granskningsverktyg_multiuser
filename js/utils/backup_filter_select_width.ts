/**
 * Beräknar min-bredd för en native select så att det längsta alternativet får plats (inte bara det valda).
 */

/** Extra utrymme för listpil / kant (native select varierar mellan webbläsare). */
const BACKUP_SELECT_DROPDOWN_CHROME_PX = 36;

/**
 * @param select Native select med färdiga option-element
 * @returns Pixelbredd inkl. padding, ram och liten marginal, eller 0
 */
export function measure_backup_select_min_width_px(select: HTMLSelectElement): number {
    if (typeof document === 'undefined' || !select?.options?.length) return 0;
    const style = window.getComputedStyle(select);
    const pad_x =
        (parseFloat(style.paddingLeft) || 0) +
        (parseFloat(style.paddingRight) || 0) +
        (parseFloat(style.borderLeftWidth) || 0) +
        (parseFloat(style.borderRightWidth) || 0);
    const tester = document.createElement('span');
    tester.setAttribute('aria-hidden', 'true');
    tester.style.cssText = [
        'position:absolute',
        'left:-9999px',
        'top:0',
        'white-space:nowrap',
        'visibility:hidden',
        `font-family:${style.fontFamily}`,
        `font-size:${style.fontSize}`,
        `font-weight:${style.fontWeight}`,
        `font-style:${style.fontStyle}`,
        `letter-spacing:${style.letterSpacing}`
    ].join(';');
    document.body.appendChild(tester);
    let max_text = 0;
    for (let i = 0; i < select.options.length; i++) {
        tester.textContent = select.options[i].text;
        max_text = Math.max(max_text, tester.offsetWidth);
    }
    document.body.removeChild(tester);
    return Math.ceil(max_text + pad_x + BACKUP_SELECT_DROPDOWN_CHROME_PX);
}
