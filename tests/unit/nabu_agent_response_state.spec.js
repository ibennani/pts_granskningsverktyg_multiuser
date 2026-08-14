import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    build_done_message,
    extract_beskrivning,
    GENERIC_BESKRIVNING,
    STATE_DIR,
    STATE_FILE,
    save_agent_response,
} from '../../.cursor/hooks/nabu_agent_response_state.mjs';

describe('nabu_agent_response_state', () => {
  /** @type {string} */
  let original_text;

  beforeEach(() => {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    original_text = fs.existsSync(STATE_FILE)
      ? fs.readFileSync(STATE_FILE, 'utf8')
      : '';
  });

  afterEach(() => {
    if (original_text) {
      fs.writeFileSync(STATE_FILE, original_text, 'utf8');
    } else if (fs.existsSync(STATE_FILE)) {
      fs.rmSync(STATE_FILE, { force: true });
    }
  });

  test('save_agent_response sparar text från hook-json', () => {
    save_agent_response(JSON.stringify({ text: 'Hooken fungerar nu på Windows.' }));
    expect(fs.readFileSync(STATE_FILE, 'utf8')).toBe('Hooken fungerar nu på Windows.');
  });

  test('extract_beskrivning tar första meningen utan kodblock', () => {
    save_agent_response(JSON.stringify({
      text: '```js\nconst x = 1;\n```\nFörsta meningen är klar. Resten följer sen.',
    }));
    expect(extract_beskrivning()).toBe('Första meningen är klar.');
  });

  test('build_done_message formaterar klar-prefix', () => {
    const msg = build_done_message('Notiser skickas automatiskt.');
    expect(msg).toContain('Nu är jag klar');
    expect(msg).toContain('Notiser skickas automatiskt.');
  });

  test('generisk beskrivning finns som konstant', () => {
    expect(GENERIC_BESKRIVNING).toContain('Cursor');
  });
});
