import { subagent_stop, try_flush } from '../../scripts/nabu_work_state.mjs';
import { handle_flush_result } from './nabu_hook_common.mjs';

subagent_stop();
const result = try_flush();
handle_flush_result(result);
