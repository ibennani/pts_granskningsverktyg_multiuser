/**
 * @fileoverview Detekterar innehållstyper på en webbsida via Puppeteer DOM-analys.
 */
import puppeteer, { type Browser, type Page } from 'puppeteer';
import {
    auto_scroll_lazy_content,
    scroll_to_top,
    settle_after_lazy_load,
} from './page_screenshot_lazy_load.js';
import {
    assert_acceptable_navigation_status,
    configure_stealth_page,
    page_has_renderable_content,
    PUPPETEER_LAUNCH_ARGS,
} from './page_screenshot_stealth.js';
import { dismiss_cookie_banners_before_screenshot } from './page_screenshot_cookie_consent.js';
import {
    get_serializable_detection_rules,
    map_dom_hits_to_content_type_ids,
    type SerializableDetectionRule,
} from './page_content_type_detection_rules.js';

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;
const DEVICE_SCALE_FACTOR = 2;
const NAVIGATION_TIMEOUT_MS = 30_000;

export type PageContentTypeSelectorRule = {
    id: string;
    selector: string;
};

export type PageContentTypeSelectorEvidence = {
    id: string;
    selector: string;
    matched: boolean;
    matchCount: number;
    error: string | null;
};

export type DetectPageContentTypesInput = {
    url: string;
    allowed_content_type_ids: string[];
    /**
     * Frivilliga regler från aktiv regelfil. När de skickas in används de som
     * auktoritativ DOM-detektor för respektive ID, samtidigt som legacy-signaler
     * fortsätter fungera för andra ID:n.
     */
    selector_rules?: PageContentTypeSelectorRule[];
    timeout_ms?: number;
};

export type DetectPageContentTypesResult = {
    detected_content_type_ids: string[];
    triggered_signals: string[];
    selector_evidence: PageContentTypeSelectorEvidence[];
};

async function prepare_page(page: Page): Promise<void> {
    await configure_stealth_page(page);
    await page.setViewport({
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        deviceScaleFactor: DEVICE_SCALE_FACTOR,
    });
}

async function navigate_and_validate(page: Page, url: string, timeout_ms: number): Promise<void> {
    const response = await page.goto(url, {
        waitUntil: 'load',
        timeout: timeout_ms,
    });

    if (!response) {
        throw new Error('Ingen svar från sidan');
    }

    const status = response.status();
    const has_content = await page_has_renderable_content(page);
    assert_acceptable_navigation_status(status, has_content);
}

async function prepare_page_content(page: Page): Promise<void> {
    await dismiss_cookie_banners_before_screenshot(page, { wait_for_banner: false });
    await auto_scroll_lazy_content(page);
    await settle_after_lazy_load(page);
    await scroll_to_top(page);
    await dismiss_cookie_banners_before_screenshot(page, { wait_for_banner: false });
}

const COMMON_CONTENT_MARKER_SELECTOR =
    'form, table, nav, main, img, video, audio, h1, h2, h3, [role="navigation"], [role="table"], [role="main"]';

/** Väntar kort på vanliga innehållselement (SPA) utan att avbryta om inget hittas. */
async function wait_for_common_content_markers(page: Page): Promise<void> {
    try {
        await page.waitForSelector(COMMON_CONTENT_MARKER_SELECTOR, { timeout: 5000 });
    } catch {
        // Sidor utan dessa element — fortsätt ändå.
    }
}

async function collect_triggered_signals(
    page: Page,
    rules: SerializableDetectionRule[]
): Promise<string[]> {
    return page.evaluate((eval_rules: SerializableDetectionRule[]) => {
        const triggered: string[] = [];
        for (const rule of eval_rules) {
            let found = false;
            for (const selector of rule.selectors) {
                try {
                    if (document.querySelector(selector)) {
                        found = true;
                        break;
                    }
                } catch {
                    // Ogiltig legacy-selector — hoppa över.
                }
            }
            if (found && !triggered.includes(rule.signal)) {
                triggered.push(rule.signal);
            }
        }
        return triggered;
    }, rules);
}

function sanitize_selector_rules(
    rules: PageContentTypeSelectorRule[] | undefined,
    allowed: Set<string>
): PageContentTypeSelectorRule[] {
    if (!Array.isArray(rules)) return [];
    const seen = new Set<string>();
    const result: PageContentTypeSelectorRule[] = [];
    for (const rule of rules) {
        const id = String(rule?.id || '').trim();
        const selector = String(rule?.selector || '').trim();
        if (!id || !selector || !allowed.has(id)) continue;
        const key = `${id}\u0000${selector}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ id, selector });
    }
    return result;
}

async function collect_selector_evidence(
    page: Page,
    rules: PageContentTypeSelectorRule[]
): Promise<PageContentTypeSelectorEvidence[]> {
    if (rules.length === 0) return [];
    return page.evaluate((eval_rules: PageContentTypeSelectorRule[]) => {
        return eval_rules.map((rule) => {
            try {
                const count = document.querySelectorAll(rule.selector).length;
                return {
                    id: rule.id,
                    selector: rule.selector,
                    matched: count > 0,
                    matchCount: count,
                    error: null,
                };
            } catch (error) {
                return {
                    id: rule.id,
                    selector: rule.selector,
                    matched: false,
                    matchCount: 0,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        });
    }, rules);
}

/**
 * Navigerar till URL och returnerar detekterade innehållstyp-ID:n från regelfilen.
 *
 * Legacy-reglerna finns kvar för bakåtkompatibilitet. selector_rules gör att
 * nya/ändrade innehållstyper kan styras helt från regelfilen utan kodändring.
 */
export async function detect_page_content_types(
    input: DetectPageContentTypesInput
): Promise<DetectPageContentTypesResult> {
    const {
        url,
        allowed_content_type_ids,
        selector_rules,
        timeout_ms = NAVIGATION_TIMEOUT_MS,
    } = input;
    const sanitized_allowed = [...new Set(
        allowed_content_type_ids.map((id) => String(id || '').trim()).filter(Boolean)
    )];

    if (sanitized_allowed.length === 0) {
        return {
            detected_content_type_ids: [],
            triggered_signals: [],
            selector_evidence: [],
        };
    }

    const allowed_set = new Set(sanitized_allowed);
    const configured_rules = sanitize_selector_rules(selector_rules, allowed_set);
    let browser: Browser | undefined;

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: PUPPETEER_LAUNCH_ARGS,
        });
        const page = await browser.newPage();
        await prepare_page(page);
        await navigate_and_validate(page, url, timeout_ms);
        await prepare_page_content(page);
        await wait_for_common_content_markers(page);

        const legacy_rules = get_serializable_detection_rules();
        const triggered_signals = await collect_triggered_signals(page, legacy_rules);
        const legacy_detected = map_dom_hits_to_content_type_ids(
            sanitized_allowed,
            triggered_signals
        );
        const selector_evidence = await collect_selector_evidence(page, configured_rules);
        const detected = new Set(legacy_detected);
        for (const evidence of selector_evidence) {
            if (evidence.matched) detected.add(evidence.id);
        }

        return {
            detected_content_type_ids: [...detected].sort(),
            triggered_signals,
            selector_evidence,
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
