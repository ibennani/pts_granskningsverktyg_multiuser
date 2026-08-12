/**
 * @fileoverview Alla CMP-leverantörspaket samlade i en fil (Jest-vänlig import).
 */
import type { CmpVendorPackage } from '../cmp_vendor_types.js';

export const cookiebot_vendor: CmpVendorPackage = {
    id: 'cookiebot',
    network_suffixes: ['consent.cookiebot.com', 'consentcdn.cookiebot.com'],
    accept_button_selectors: [
        '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
        '#CybotCookiebotDialogBodyButtonAccept',
    ],
    banner_container_selectors: ['#CybotCookiebotDialog'],
    exact_cookie_names: ['CookieConsent'],
};

export const onetrust_vendor: CmpVendorPackage = {
    id: 'onetrust',
    network_suffixes: ['cdn.cookielaw.org', 'geolocation.onetrust.com'],
    accept_button_selectors: ['#onetrust-accept-btn-handler'],
    banner_container_selectors: [
        '#onetrust-banner-sdk',
        '#onetrust-consent-sdk',
        '#onetrust-pc-sdk',
    ],
    exact_cookie_names: ['OptanonConsent', 'OptanonAlertBoxClosed'],
    cookie_name_regexes: [/^optanon/i],
};

export const usercentrics_vendor: CmpVendorPackage = {
    id: 'usercentrics',
    network_suffixes: ['app.usercentrics.eu', 'api.usercentrics.eu'],
    banner_container_selectors: ['#usercentrics-root'],
    exact_cookie_names: ['uc_user_interaction'],
    exact_local_storage_keys: ['uc_settings'],
    cookie_name_regexes: [/^uc_/i],
    local_storage_regexes: [/^uc_/i],
};

export const didomi_vendor: CmpVendorPackage = {
    id: 'didomi',
    network_suffixes: ['sdk.privacy-center.org', 'privacy-center.org'],
    accept_button_selectors: ['#didomi-notice-agree-button'],
    banner_container_selectors: ['#didomi-host', '#didomi-notice'],
    exact_local_storage_keys: ['didomi_token', 'didomi_config'],
    cookie_name_regexes: [/^didomi/i],
    local_storage_regexes: [/^didomi/i],
};

export const cookieyes_vendor: CmpVendorPackage = {
    id: 'cookieyes',
    network_suffixes: ['cdn-cookieyes.com'],
    accept_button_selectors: [
        '#cookieyes-accept-btn',
        '.cky-btn-accept',
        '.cky-btn.cky-btn-accept',
    ],
    banner_container_selectors: ['.cookieyes-banner', '#cky-banner'],
    exact_cookie_names: ['cookieyes-consent'],
    cookie_name_regexes: [/^cookieyes/i],
};

export const termly_vendor: CmpVendorPackage = {
    id: 'termly',
    network_suffixes: ['cdn.termly.io', 'app.termly.io'],
    accept_button_selectors: [
        '[data-tid="banner-accept"]',
        '#termly-code-snippet-support button[data-tid="banner-accept"]',
        '.t-consent-banner button.t-acceptAll',
        '#termly-consent button',
    ],
    banner_container_selectors: [
        '#termly-code-snippet-support',
        '.t-consent-banner',
        '#termly-consent',
    ],
    cookie_name_regexes: [/^termly/i],
    local_storage_regexes: [/^termly/i],
};

export const iubenda_vendor: CmpVendorPackage = {
    id: 'iubenda',
    network_suffixes: ['cdn.iubenda.com', 'embeds.iubenda.com'],
    accept_button_selectors: [
        '.iubenda-cs-accept-btn',
        '#iubenda-cs-banner .iubenda-cs-accept-btn',
        'button.iubenda-cs-accept-btn',
    ],
    banner_container_selectors: ['#iubenda-cs-banner', '.iubenda-cs-default'],
    cookie_name_regexes: [/^iubenda/i, /^_iub_cs/i],
    local_storage_regexes: [/^iubenda/i],
};

export const complianz_vendor: CmpVendorPackage = {
    id: 'complianz',
    network_suffixes: ['complianz.io', 'cdn.complianz.io'],
    network_path_substrings: ['complianz'],
    accept_button_selectors: [
        '.cmplz-accept',
        '.cmplz-btn.cmplz-accept',
        'button.cmplz-accept',
    ],
    banner_container_selectors: [
        '#cmplz-cookiebanner-container',
        '.cmplz-cookiebanner',
        '.cmplz-document',
    ],
    cookie_name_regexes: [/^cmplz_/i],
    local_storage_regexes: [/^cmplz/i],
};

export const borlabs_vendor: CmpVendorPackage = {
    id: 'borlabs',
    network_suffixes: ['borlabs.io', 'cookie.borlabs.io'],
    network_path_substrings: ['borlabs'],
    accept_button_selectors: [
        '#BorlabsCookieBox .borlabs-cookie-btn',
        '.borlabs-cookie-btn',
        '[data-borlabs-cookie-accept]',
    ],
    banner_container_selectors: ['#BorlabsCookieBox', '.BorlabsCookie'],
    exact_cookie_names: ['borlabsCookie'],
    cookie_name_regexes: [/^borlabs/i],
    local_storage_regexes: [/^borlabs/i],
};

export const real_cookie_banner_vendor: CmpVendorPackage = {
    id: 'real_cookie_banner',
    network_suffixes: ['devowl.io'],
    network_path_substrings: ['real-cookie-banner'],
    accept_button_selectors: [
        '[data-rcb-action="accept"]',
        '.rcb-bar button[data-rcb-action="accept"]',
        '#realCookieBanner button.rcb-btn-accept',
    ],
    banner_container_selectors: [
        '#realCookieBanner',
        '.rcb-bar',
        '.real-cookie-banner',
    ],
    cookie_name_regexes: [/^rcb_/i],
    local_storage_regexes: [/^rcb/i],
};

export const cookiefirst_vendor: CmpVendorPackage = {
    id: 'cookiefirst',
    network_suffixes: ['consent.cookiefirst.com', 'cdn.cookiefirst.com'],
    accept_button_selectors: [
        '#cookiefirst-root button[data-cookiefirst-action="accept"]',
        '.cf2Lf button',
        '[data-cookiefirst-action="accept"]',
    ],
    banner_container_selectors: ['#cookiefirst-root', '.cf2Lf', '.cookiefirst-root'],
    local_storage_regexes: [/cookiefirst/i],
};

export const tarteaucitron_vendor: CmpVendorPackage = {
    id: 'tarteaucitron',
    network_suffixes: ['tarteaucitron.io', 'cdn.tarteaucitron.io'],
    accept_button_selectors: [
        '#tarteaucitronPersonalize2',
        '#tarteaucitronAllAllowed',
        '#tarteaucitronRoot #tarteaucitronPersonalize2',
    ],
    banner_container_selectors: [
        '#tarteaucitronRoot',
        '#tarteaucitronAlertBig',
        '#tarteaucitronMainLineOffset',
    ],
};

export const commanders_act_vendor: CmpVendorPackage = {
    id: 'commanders_act',
    network_suffixes: [
        'tagcommander.com',
        'trustcommander.net',
        'cdn.trustcommander.net',
        'tc.global',
    ],
    accept_button_selectors: [
        '.tc-privacy-button',
        '#tc-banner button.tc-privacy-button',
        '.tc-privacy-accept',
        'button[data-tc-action="accept"]',
    ],
    banner_container_selectors: ['#tc-banner', '.tc-privacy-banner', '#tc-privacy-wrapper'],
};

export const schibsted_sourcepoint_vendor: CmpVendorPackage = {
    id: 'schibsted_sourcepoint',
    network_suffixes: [
        'privacy-mgmt.com',
        'privacy.schibsted.com',
        'sourcepoint.mgr.consensu.org',
    ],
    accept_button_selectors: [
        'button.sp_choice_type_11',
        'button.sp_choice_type_ACCEPT_ALL',
        'button[title="Godkänn alla cookies"]',
        'button[title="Godkänn alla"]',
        '#notice button[title="Godkänn alla cookies"]',
        '#notice button[title="Godkänn alla"]',
    ],
    banner_container_selectors: [
        '#sp-cc',
        '[id^="sp_message_container_"]',
        '[id^="sp_message_iframe"]',
        '#notice',
        '.sch-datacontroller',
        '#schibsted-data-controller-sticky',
        '.schibsted-data-controller',
    ],
    cookie_name_regexes: [/^sp_consent/i, /^euconsent/i],
};

export const misc_cmp_vendors: CmpVendorPackage[] = [
    {
        id: 'osano',
        network_suffixes: ['cmp.osano.com'],
        accept_button_selectors: ['.osano-cm-accept-all'],
    },
    {
        id: 'trustarc',
        network_suffixes: ['consent.trustarc.com'],
        accept_button_selectors: ['#truste-consent-button'],
    },
    {
        id: 'axeptio',
        network_suffixes: ['static.axept.io', 'cdn.axept.io'],
        banner_container_selectors: ['.coi-overlay'],
        accept_button_selectors: ['.coi-banner__accept', '#ccc-notify-accept'],
    },
    {
        id: 'klaro',
        banner_container_selectors: ['#klaro', 'div#cc--main'],
        exact_local_storage_keys: ['klaro'],
        local_storage_regexes: [/klaro/i],
    },
    {
        id: 'quantcast',
        network_suffixes: ['cmp.quantcast.com'],
        banner_container_selectors: ['.qc-cmp2-container'],
    },
    {
        id: 'cookie_information',
        network_suffixes: ['policy.app.cookieinformation.com'],
        exact_cookie_names: ['CookieInformationConsent'],
    },
    {
        id: 'consent_manager',
        network_suffixes: ['cdn.consentmanager.net', 'delivery.consentmanager.net'],
    },
    {
        id: 'kiprotect',
        network_suffixes: ['cdn.kiprotect.com'],
    },
    {
        id: 'silktide',
        banner_container_selectors: ['.silktide-banner'],
    },
    {
        id: 'civic',
        banner_container_selectors: ['#civic-cookie-control'],
    },
    {
        id: 'cookie_law_info',
        banner_container_selectors: [
            '#cookie-law-info-bar',
            '.cookie-law-info-bar',
        ],
    },
    {
        id: 'cookiescript',
        banner_container_selectors: ['#cookiescript_injected'],
    },
];

export const CMP_VENDORS: readonly CmpVendorPackage[] = [
    cookiebot_vendor,
    onetrust_vendor,
    usercentrics_vendor,
    didomi_vendor,
    cookieyes_vendor,
    termly_vendor,
    iubenda_vendor,
    complianz_vendor,
    borlabs_vendor,
    real_cookie_banner_vendor,
    cookiefirst_vendor,
    tarteaucitron_vendor,
    commanders_act_vendor,
    schibsted_sourcepoint_vendor,
    ...misc_cmp_vendors,
];
