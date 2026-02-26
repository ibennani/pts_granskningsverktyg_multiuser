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
  start_view_h1: 'Granskningsverktyget',
  start_view_intro: 'Välkommen till Granskningsverktyget.',
  start_view_audits_heading: 'Aktuella ärenden',
  start_view_no_audits: 'Inga granskningar finns ännu.',
  admin_loading: 'Laddar...',
  // Matchar nycklar i js/i18n/*.json så att även skiplänk och landmarks testas med översättningar
  skip_to_content: 'Hoppa till innehållet',
  landmark_top_navigation: 'Övre navigering',
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
  if (topNav) {
    topNav.setAttribute('aria-label', window.Translation.t('landmark_top_navigation'));
  }

  window.NotificationComponent = {
    get_global_message_element_reference: jest.fn().mockReturnValue(document.createElement('div')),
    clear_global_message: jest.fn(),
    show_global_message: jest.fn(),
  };

  const { StartViewComponent } = await import(
    '../../js/components/StartViewComponent.js'
  );
  const appContainer = document.getElementById('app-container');

  await StartViewComponent.init({
    root: appContainer,
    deps: {
      router: jest.fn(),
      getState: () => ({}),
      dispatch: jest.fn(),
      StoreActionTypes: {},
      Translation: window.Translation,
      Helpers: window.Helpers,
      NotificationComponent: window.NotificationComponent,
    },
  });

  // Mock API
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
  });

  StartViewComponent.render();

  return { StartViewComponent, appContainer };
}

afterEach(() => {
  jest.resetModules();
  document.body.innerHTML = '';
  if (global.fetch?.mockRestore) global.fetch.mockRestore();
});

test('renders start view with heading and audits section', async () => {
  const { StartViewComponent, appContainer } = await renderStartView();

  const h1 = screen.getByRole('heading', { level: 1 });
  expect(h1).toHaveTextContent('Granskningsverktyget');

  const h2 = screen.getByRole('heading', { name: 'Aktuella ärenden' });
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
