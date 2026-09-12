'use strict';

const { randomUUID } = require('crypto');

const PERMISSIONS = [
  ['question.view', 'View Questions', 'question'],
  ['question.create', 'Create Questions', 'question'],
  ['question.update', 'Update Questions', 'question'],
  ['question.approve', 'Approve Questions', 'question'],
  ['question.reject', 'Reject Questions', 'question'],
  ['test.view', 'View Tests', 'test'],
  ['test.create', 'Create Tests', 'test'],
  ['test.update', 'Update Tests', 'test'],
  ['test.validate', 'Validate Tests', 'test'],
  ['test.publish', 'Publish Tests', 'test'],
  ['test.close', 'Close Tests', 'test'],
  ['product.view', 'View Products', 'product'],
  ['product.create', 'Create Products', 'product'],
  ['product.update', 'Update Products', 'product'],
  ['payment.view', 'View Payments', 'payment'],
  ['student.view', 'View Students', 'student'],
  ['attempt.view', 'View Attempts', 'attempt'],
  ['result.view', 'View Results', 'result'],
  ['result.release', 'Release Results', 'result'],
  ['ai.generate', 'Generate AI Questions', 'ai'],
];

const ROLES = [
  { code: 'SUPER_ADMIN', name: 'Super Admin', isSystemRole: true },
  { code: 'ADMIN', name: 'Admin', isSystemRole: true },
  { code: 'STUDENT', name: 'Student', isSystemRole: true },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const permissionRows = PERMISSIONS.map(([code, name, module]) => ({
      id: randomUUID(),
      code,
      name,
      module,
      created_at: now,
    }));
    await queryInterface.bulkInsert('permissions', permissionRows);

    const roleRows = ROLES.map((role) => ({
      id: randomUUID(),
      code: role.code,
      name: role.name,
      is_system_role: role.isSystemRole,
      created_at: now,
      updated_at: now,
    }));
    await queryInterface.bulkInsert('roles', roleRows);

    const superAdminRole = roleRows.find((r) => r.code === 'SUPER_ADMIN');
    const adminRole = roleRows.find((r) => r.code === 'ADMIN');

    // SUPER_ADMIN and ADMIN get every currently-defined permission. As more
    // granular permissions (e.g. role/permission management) are added in
    // later phases, differentiate ADMIN from SUPER_ADMIN then — see
    // docs/AUTHENTICATION.md.
    const rolePermissionRows = [];
    for (const perm of permissionRows) {
      rolePermissionRows.push({ role_id: superAdminRole.id, permission_id: perm.id, created_at: now });
      rolePermissionRows.push({ role_id: adminRole.id, permission_id: perm.id, created_at: now });
    }
    await queryInterface.bulkInsert('role_permissions', rolePermissionRows);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE code IN (:codes))',
      { replacements: { codes: ROLES.map((r) => r.code) } },
    );
    await queryInterface.bulkDelete('roles', { code: ROLES.map((r) => r.code) });
    await queryInterface.bulkDelete(
      'permissions',
      { code: PERMISSIONS.map(([code]) => code) },
    );
  },
};
