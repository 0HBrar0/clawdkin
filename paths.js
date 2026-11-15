// Where Clawdkin keeps its data. Shared by the app, the Claude Code hook and the installer, so they
// always agree. Defaults to ~/.clawdkin; set CLAWDKIN_HOME to put it somewhere else (tests do this).
const os = require('os');
const path = require('path');

const HOME = process.env.CLAWDKIN_HOME || path.join(os.homedir(), '.clawdkin');

module.exports = {
  HOME,
  STATE: path.join(HOME, 'state'),        // one small JSON file per Claude Code session
  REQUESTS: path.join(HOME, 'requests'),  // Quick reply: pending questions and their answers
  LOG: path.join(HOME, 'events.log'),     // one line per event; the app folds it into memory.json
  CONFIG: path.join(HOME, 'config.json'),
  MEMORY: path.join(HOME, 'memory.json'),
  ALIVE: path.join(HOME, 'state', '.alive'),
  DEBUG: path.join(HOME, 'debug'),
  ERRORS: path.join(HOME, 'errors.log'), // errors from the app and its windows (kept small)
};
