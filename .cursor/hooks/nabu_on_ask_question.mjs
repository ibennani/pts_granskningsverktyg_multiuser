/**
 * postToolUse-hook: skickar fråge-notis när agenten använder AskQuestion.
 */

import { send_fraga_notification, extract_ask_question_summary, save_question_summary } from '../../scripts/nabu_fraga_notify.mjs';
import { get_question_summary } from '../../scripts/nabu_project_klar_message.mjs';
import { read_hook_input, REPO_ROOT } from './nabu_hook_common.mjs';

const hook_input = read_hook_input();
const extracted = extract_ask_question_summary(hook_input);
const existing = get_question_summary(REPO_ROOT);

if (!existing && extracted) {
    save_question_summary(REPO_ROOT, extracted);
}

await send_fraga_notification(REPO_ROOT, { summary: existing || extracted });
