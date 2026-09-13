'use strict';

const { randomUUID } = require('crypto');
const { QueryTypes } = require('sequelize');

const PERMISSIONS = [['entitlement.grant', 'Manually Grant Entitlements', 'entitlement']];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const sequelize = queryInterface.sequelize;

    const permissionRows = PERMISSIONS.map(([code, name, module]) => ({
      id: randomUUID(),
      code,
      name,
      module,
      created_at: now,
    }));
    await queryInterface.bulkInsert('permissions', permissionRows);

    const roles = await sequelize.query("SELECT id, code FROM roles WHERE code IN ('SUPER_ADMIN', 'ADMIN')", {
      type: QueryTypes.SELECT,
    });

    const rolePermissionRows = [];
    for (const role of roles) {
      for (const perm of permissionRows) {
        rolePermissionRows.push({ role_id: role.id, permission_id: perm.id, created_at: now });
      }
    }
    await queryInterface.bulkInsert('role_permissions', rolePermissionRows);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code IN (:codes))',
      { replacements: { codes: PERMISSIONS.map(([code]) => code) } },
    );
    await queryInterface.bulkDelete('permissions', { code: PERMISSIONS.map(([code]) => code) });
  },
};
