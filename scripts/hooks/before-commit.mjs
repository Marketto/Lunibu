// PreToolUse hook on Bash: before git commit/push, run the secret scan.
import { execSync } from 'node:child_process';
let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let cmd = '';
  try { cmd = JSON.parse(input).tool_input?.command || ''; } catch {}
  if (!/\bgit\s+(-c\s+\S+\s+)*(commit|push)\b/.test(cmd)) process.exit(0);
  // Regola 7: l'autore dei commit deve usare l'indirizzo noreply di GitHub.
  if (/\bgit\s+(-c\s+\S+\s+)*commit\b/.test(cmd)) {
    const m = /user\.email=(\S+)/.exec(cmd);
    let email = m ? m[1].replace(/["']/g, '') : '';
    if (!email) { try { email = execSync('git config user.email', { stdio: 'pipe' }).toString().trim(); } catch {} }
    if (!email.endsWith('@users.noreply.github.com')) {
      process.stderr.write(`Autore del commit non ammesso (${email || 'nessuna email'}): usa l'indirizzo users.noreply.github.com (CLAUDE.md, regola 7).\n`);
      process.exit(2);
    }
  }
  try {
    execSync('node scripts/check-secrets.mjs', { stdio: 'pipe' });
    process.exit(0);
  } catch (e) {
    process.stderr.write(String(e.stdout || e.stderr || e.message));
    process.exit(2);
  }
});
