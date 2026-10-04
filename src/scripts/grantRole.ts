/**
 * Give an account (by email) a role — e.g. make someone a SUPER_ADMIN.
 *
 *   npm run user:grant-role -- --email someone@example.com --role SUPER_ADMIN
 *   (production build: node dist/scripts/grantRole.js --email ... --role ...)
 *
 * Creates the account if needed; the person then signs in with Google or an
 * email code to that address. See roleAssignmentService.grantRoleByEmail.
 */
import { sequelize } from '../models';
import { grantRoleByEmail } from '../services/roleAssignmentService';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  // Keep the output to the one result line (dev mode logs every query).
  (sequelize as unknown as { options: { logging: unknown } }).options.logging = false;
  const email = arg('email');
  const role = arg('role');
  if (!email || !role || !/^\S+@\S+\.\S+$/.test(email)) {
    console.error('Usage: npm run user:grant-role -- --email <address> --role <ROLE_CODE>');
    process.exitCode = 1;
    return;
  }

  const result = await grantRoleByEmail(email, role.toUpperCase());
  console.log(
    `${result.roleAdded ? 'Granted' : 'Already had'} ${result.roleCode} → ${result.email}` +
      (result.userCreated ? ' (new account; they sign in with Google or an email code)' : ''),
  );
}

main()
  .catch((err: Error) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
