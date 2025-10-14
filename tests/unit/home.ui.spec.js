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
  app_title: 'Verktyg för tillsyn av tillgänglighet',
  upload_view_intro:
    'Välkommen! Ladda upp en sparad granskning eller starta en ny granskning genom att ladda upp en regelfil',
  upload_view_actions_title: 'Vad vill du göra?',
  upload_ongoing_audit: 'Ladda upp pågående granskning',
  upload_view_description_resume_audit:
    'Återuppta en tidigare granskning genom att ladda upp den sparade filen.',
  start_new_audit: 'Starta ny granskning',
  upload_view_description_start_new:
    'Börja en ny tillgänglighetsgranskning från början genom att ladda upp en regelfil.',
  upload_view_title_edit: 'Redigera en regelfil',
  upload_view_button_edit: 'Redigera regelfil',
  upload_view_description_edit_rulefile:
    'Gör ändringar i en befintlig regelfil eller skapa en ny version.',
};

async function renderStartView() {
  const html = fs.readFileSync(indexHtmlPath, 'utf-8');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : '';
  document.body.innerHTML = bodyContent;

  await import('../../js/utils/helpers.js');

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

  window.NotificationComponent = {
    get_global_message_element_reference: jest.fn().mockReturnValue(null),
    clear_global_message: jest.fn(),
    show_global_message: jest.fn(),
  };

  const { UploadViewComponent } = await import(
    '../../js/components/UploadViewComponent.js'
  );
  const appContainer = document.getElementById('app-container');

  await UploadViewComponent.init(
    appContainer,
    jest.fn(),
    {},
    () => ({}),
    jest.fn(),
    {}
  );
  UploadViewComponent.render();

  return { UploadViewComponent, appContainer };
}

afterEach(() => {
  jest.resetModules();
  document.body.innerHTML = '';
});

test('renders start view buttons and infotexts in correct order with aria descriptors', async () => {
  const { UploadViewComponent, appContainer } = await renderStartView();

  const loadButton = screen.getByRole('button', {
    name: 'Ladda upp pågående granskning',
  });
  const startButton = screen.getByRole('button', {
    name: 'Starta ny granskning',
  });
  const editButton = screen.getByRole('button', { name: 'Redigera regelfil' });

  const buttonOrder = Array.from(
    appContainer.querySelectorAll('.upload-action-block button')
  ).map((button) => button.id);

  expect(buttonOrder).toEqual([
    'load-ongoing-audit-btn',
    'start-new-audit-btn',
    'edit-rulefile-btn',
  ]);

  const separator = appContainer.querySelector('hr');
  expect(separator).toBeInTheDocument();

  const loadDescriptionId = loadButton.getAttribute('aria-describedby');
  const startDescriptionId = startButton.getAttribute('aria-describedby');
  const editDescriptionId = editButton.getAttribute('aria-describedby');

  expect(document.getElementById(loadDescriptionId)).toHaveTextContent(
    'Återuppta en tidigare granskning genom att ladda upp den sparade filen.'
  );
  expect(document.getElementById(startDescriptionId)).toHaveTextContent(
    'Börja en ny tillgänglighetsgranskning från början genom att ladda upp en regelfil.'
  );
  expect(document.getElementById(editDescriptionId)).toHaveTextContent(
    'Gör ändringar i en befintlig regelfil eller skapa en ny version.'
  );

  UploadViewComponent.destroy();
});

test('start view has no obvious accessibility violations', async () => {
  const { UploadViewComponent } = await renderStartView();

  const results = await axe(document.body, {
    rules: {
      region: {
        enabled: false,
      },
    },
  });
  expect(results).toHaveNoViolations();

  UploadViewComponent.destroy();
});
