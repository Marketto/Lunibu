// PreToolUse hook on Bash: before git commit/push, run the secret scan and check the commit author (rule 7).
import { execSync } from 'node:child_process';
const OK = (e) => /@users\.noreply\.github\.com$/.test(e);
const clean = (s) => String(s || '').replace(/^["']|["']$/g, '').replace(/^.*<|>.*$/g, '').trim();
let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let cmd = '';
  try { cmd = JSON.parse(input).tool_input?.command || ''; } catch {}
  // Ogni invocazione di git fino al primo separatore di comando; prudente: basta che compaia commit/push.
  const calls = [...cmd.matchAll(/\bgit\b([^;&|\n]*)/g)].map((m) => m[1]);
  const isCommit = calls.some((c) => /(^|\s)commit(\s|$)/.test(c));
  const isPush = calls.some((c) => /(^|\s)push(\s|$)/.test(c));
  if (!isCommit && !isPush) process.exit(0);
  const fail = (msg) => { process.stderr.write(msg + '\n'); process.exit(2); };
  if (isCommit) {
    for (const c of calls.filter((x) => /(^|\s)commit(\s|$)/.test(x))) {
      const pre = c.slice(0, c.search(/(^|\s)commit(\s|$)/)); // opzioni globali prima del sottocomando
      const post = c.slice(pre.length);
      const author = /--author[=\s]+("[^"]*"|'[^']*'|\S+)/.exec(post);
      if (author && !OK(clean(author[1]))) fail(`Autore non ammesso in --author: usa users.noreply.github.com (CLAUDE.md, regola 7).`);
      const m = /user\.email=("[^"]*"|'[^']*'|\S+)/.exec(pre);
      let email = m ? clean(m[1]) : '';
      if (!email) { try { email = execSync('git config user.email', { stdio: 'pipe' }).toString().trim(); } catch {} }
      if (!OK(email)) fail(`Autore del commit non ammesso (${email || 'nessuna email'}): usa l'indirizzo users.noreply.github.com (CLAUDE.md, regola 7).`);
    }
    for (const v of ['GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_EMAIL']) {
      const m = new RegExp(`\\b${v}=("[^"]*"|'[^']*'|\\S+)`).exec(cmd);
      if (m && !OK(clean(m[1]))) fail(`${v} non ammesso: usa users.noreply.github.com (CLAUDE.md, regola 7).`);
    }
  }
  try {
    execSync('node scripts/check-secrets.mjs', { stdio: 'pipe' });
    process.exit(0);
  } catch (e) {
    fail(String(e.stdout || e.stderr || e.message));
  }
});
