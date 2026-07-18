import { expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

it('associates readable registration guidance with its fields', () => {
  const html = readFileSync('src/client/login.html', 'utf8');
  const css = readFileSync('src/client/css/auth.css', 'utf8');
  const login = readFileSync('src/client/js/login.js', 'utf8');

  expect(html).toContain('aria-describedby="register-username-help"');
  expect(html).toContain('aria-describedby="register-password-help"');
  expect(html).toContain('pattern="[A-Za-z0-9_\\-]+"');
  expect(css.match(/\.form-group small\s*\{([^}]*)\}/)?.[1]).not.toContain('opacity');
  expect(login).toContain("document.querySelectorAll('.error-message').forEach");
  expect(login).toContain("error.classList.remove('show')");
});
