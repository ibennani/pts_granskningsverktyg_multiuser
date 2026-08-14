import fs from 'node:fs';
import { save_agent_response } from './nabu_agent_response_state.mjs';

function read_stdin() {
    try {
        return fs.readFileSync(0, 'utf8');
    } catch {
        return '';
    }
}

save_agent_response(read_stdin());
