import { sync_todos } from '../../scripts/nabu_work_state.mjs';
import { extract_todos_from_hook, invoke_try_flush, read_hook_input } from './nabu_hook_common.mjs';

const hook_input = read_hook_input();
const todos = extract_todos_from_hook(hook_input);
if (todos) {
    sync_todos(todos);
    invoke_try_flush();
}
