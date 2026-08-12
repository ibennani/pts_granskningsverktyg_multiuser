/**
 * @fileoverview Säker interaktionspolicy för snapshot-analys.
 */
import type { SafeInteractionVerdict } from './snapshot_analysis_types.js';

const DESTRUCTIVE_KEYWORDS = [
    'delete', 'remove', 'logout', 'log out', 'sign out', 'unsubscribe',
    'checkout', 'purchase', 'buy', 'pay', 'payment', 'book', 'order',
    'login', 'sign in', 'register', 'upload', 'submit',
];

export function classify_safe_interaction(element: {
    tagName?: string;
    type?: string | null;
    role?: string | null;
    href?: string | null;
    ariaExpanded?: string | null;
    ariaControls?: string | null;
    ariaHaspopup?: string | null;
    text?: string | null;
    isSummary?: boolean;
}): SafeInteractionVerdict {
    const tag = (element.tagName || '').toLowerCase();
    const type = (element.type || '').toLowerCase();
    const text = (element.text || '').toLowerCase().trim();

    if (tag === 'a' && element.href) {
        return { safe: false, reason: 'link-navigation' };
    }
    if (tag === 'form') {
        return { safe: false, reason: 'form-element' };
    }
    if (tag === 'input' && (type === 'submit' || type === 'button' && text.includes('submit'))) {
        return { safe: false, reason: 'submit-control' };
    }
    if (tag === 'button' && type === 'submit') {
        return { safe: false, reason: 'submit-button' };
    }
    if (type === 'password' || type === 'file') {
        return { safe: false, reason: 'sensitive-input' };
    }

    for (const kw of DESTRUCTIVE_KEYWORDS) {
        if (text.includes(kw)) {
            return { safe: false, reason: `destructive-keyword:${kw}` };
        }
    }

    if (tag === 'summary') {
        return { safe: true, reason: 'details-summary' };
    }
    if (element.ariaExpanded != null) {
        return { safe: true, reason: 'aria-expanded-control' };
    }
    if (element.ariaControls) {
        return { safe: true, reason: 'aria-controls' };
    }
    if (element.ariaHaspopup != null) {
        return { safe: true, reason: 'aria-haspopup' };
    }
    if (tag === 'button' && element.role === 'button') {
        if (!element.href && !type) {
            return { safe: true, reason: 'local-button' };
        }
    }
    if (tag === 'button' && !type && !element.href) {
        return { safe: true, reason: 'button-no-navigation' };
    }

    return { safe: false, reason: 'uncertain' };
}

export function is_write_method(method: string): boolean {
    const m = method.toUpperCase();
    return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
}
