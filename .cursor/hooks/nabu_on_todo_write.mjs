import { sync_todos, try_flush } from '../../scripts/nabu_work_state.mjs';
import { extract_todos_from_hook, handle_flush_result, read_hook_input } from './nabu_hook_common.mjs';

const hook_input = read_hook_input();
const todos = extract_todos_from_hook(hook_input);
if (todos) {
    sync_todos(todos);
    const result = try_flush();
    handle_flush_result(result);
}
