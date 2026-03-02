import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';
import { screen } from '@testing-library/dom';
import axeCore from 'jest-axe';

const { axe } = axeCore;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexHtmlPath = path.resolve(__dirname, '..', '..', 'index.html');

const translations = {
  audit_title_audits: 'Hantera granskningar',
  start_view_audits_heading: 'Pågående granskningar',
  start_view_new_audits_heading: 'Ej påbörjade granskningar',
  start_view_completed_audits_heading: 'Avslutade granskningar',
  start_view_no_audits: 'Inga granskningar finns ännu.',
  audit_loading: 'Laddar...',
  audit_api_unavailable: 'audit_api_unavailable',
  audit_upload_saved_audit: 'Ladda upp sparad granskning',
  audit_list_empty_in_progress: 'Inga pågående granskningar finns ännu.',
  audit_list_empty_not_started: 'Inga ej påbörjade granskningar finns ännu.',
  audit_list_empty_completed: 'Inga avslutade granskningar finns ännu.',
  // Matchar nycklar i js/i18n/*.json så att även skiplänk och landmarks testas med översättningar
  skip_to_content: 'Hoppa till innehållet',
  landmark_toolbar: 'Åtgärdsfält',
};

async function renderStartView() {
  const html = fs.readFileSync(indexHtmlPath, 'utf-8');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : '';
  document.body.innerHTML = bodyContent;

  const Helpers = await import('../../js/utils/helpers.js');
  window.Helpers = { ...Helpers };
  window.Helpers.load_css_safely = jest.fn().mockResolvedValue();

  window.Translation = {
    t: (key, replacements = {}) => {
      const template = translations[key] ?? key;
      return Object.entries(replacements).reduce(
        (acc, [replacementKey, replacementValue]) =>
          acc.replace(
            new RegExp(`\\{${replacementKey}\\}`, 'g'),
            replacementValue
          ),
        template
      );
    },
  };

  // Applicera samma logik som i main.js:update_landmarks_and_skip_link
  const skipLink = document.getElementById('skip-to-content');
  if (skipLink) {
    skipLink.textContent = window.Translation.t('skip_to_content');
  }
  const topNav = document.getElementById('global-action-bar-top');
  if (topNav && topNav.childElementCount > 0) {
    topNav.setAttribute('aria-label', window.Translation.t('landmark_toolbar'));
  }

  window.NotificationComponent = {
    get_global_message_element_reference: jest.fn().mockReturnValue(document.createElement('div')),
    clear_global_message: jest.fn(),
    show_global_message: jest.fn(),
  };

  const { AuditViewComponent } = await import('../../js/components/AuditViewComponent.js');
  const appContainer = document.getElementById('app-container');

  await AuditViewComponent.init({
    root: appContainer,
    deps: {
      router: jest.fn(),
      view_name: 'start',
      getState: () => ({}),
      dispatch: jest.fn(),
      StoreActionTypes: {},
      Translation: window.Translation,
      Helpers: window.Helpers,
      NotificationComponent: window.NotificationComponent,
      ValidationLogic: {
        validate_saved_audit_file: jest.fn().mockReturnValue({ isValid: false }),
        validate_rule_file_json: jest.fn().mockReturnValue({ isValid: false }),
      },
      SaveAuditLogic: {},
    },
  });

  global.fetch = jest.fn(async (url) => {
    const u = typeof url === 'string' ? url : (url?.url || '');
    if (u.includes('/health')) {
      return { ok: true, json: async () => ({}) };
    }
    if (u.includes('/audits')) {
      return { ok: true, json: async () => ([]) };
    }
    if (u.includes('/rules')) {
      return { ok: true, json: async () => ([]) };
    }
    return { ok: true, json: async () => ({}) };
  });

  await AuditViewComponent.ensure_api_data();
  AuditViewComponent._api_checked = true;
  AuditViewComponent.render();

  return { StartViewComponent: AuditViewComponent, appContainer };
}

afterEach(() => {
  jest.resetModules();
  document.body.innerHTML = '';
});

test('renders start view with heading and audits section', async () => {
  const { StartViewComponent, appContainer } = await renderStartView();

  const h1 = screen.getByRole('heading', { level: 1 });
  expect(h1).toHaveTextContent('Hantera granskningar');

  const h2 = screen.getByRole('heading', { name: 'Pågående granskningar' });
  expect(h2).toBeInTheDocument();

  StartViewComponent.destroy();
});

test('start view has no obvious accessibility violations', async () => {
  const { StartViewComponent } = await renderStartView();

  const results = await axe(document.body, {
    rules: {
      region: {
        enabled: false,
      },
    },
  });
  expect(results).toHaveNoViolations();

  StartViewComponent.destroy();
});
