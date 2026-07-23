/**
 * @fileoverview Gemensamma mål för de fyra PTS-regelfilerna vid testserver-synk.
 */

export const RULEFILE_TARGETS = [
    {
        id: 'f6aa1b17-8e9e-4610-8423-e5ab0ec016d3',
        label: 'Webb (publicerad bas)',
        use_pdf_aliases: false,
        require_all_matches: true,
        update_published: true,
    },
    {
        id: '5d7c1c26-c07b-4a0d-ba22-ccf025033135',
        label: 'Webb (arbetskopia)',
        use_pdf_aliases: false,
        require_all_matches: true,
        update_published: false,
    },
    {
        id: '7b7ec664-1acc-4835-b60c-789b6ebba894',
        label: 'PDF (publicerad bas)',
        use_pdf_aliases: true,
        require_all_matches: false,
        update_published: true,
    },
    {
        id: '55cfbabd-adb3-4c97-a7d9-929c6d2437c5',
        label: 'PDF (arbetskopia)',
        use_pdf_aliases: true,
        require_all_matches: false,
        update_published: false,
    },
];

export const RULEFILE_TARGET_IDS = RULEFILE_TARGETS.map((row) => row.id);

/** Sök aktör NetOnNet i metadata.actorName (case-insensitive). */
export const NETONNET_ACTOR_SQL_PATTERN = '%NetOnNet%';

export const DEFAULT_LOCAL_DATABASE_URL =
    'postgresql://granskning:granskning@localhost:5432/granskningsverktyget';

export const DEFAULT_TEST_DATABASE_URL =
    'postgresql://granskning:granskning@localhost:5432/granskningsverktyget_test';
