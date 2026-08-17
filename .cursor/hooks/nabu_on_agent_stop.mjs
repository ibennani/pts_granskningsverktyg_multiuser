/**
 * Skickar klar-notis när agenten slutar utan att notify_done.cmd redan hanterat det.
 */

import { handle_agent_stop_notify } from '../../scripts/nabu_agent_stop_notify.mjs';
import { read_hook_input, REPO_ROOT } from './nabu_hook_common.mjs';

await handle_agent_stop_notify(REPO_ROOT, read_hook_input());
