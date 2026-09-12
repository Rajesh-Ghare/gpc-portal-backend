'use strict';

const { randomUUID } = require('crypto');
const { QueryTypes } = require('sequelize');

const USERS = [
  { mobileNumber: '9000000001', fullName: 'Super Admin', roleCode: 'SUPER_ADMIN' },
  { mobileNumber: '9000000002', fullName: 'Admin User', roleCode: 'ADMIN' },
  { mobileNumber: '9000000003', fullName: 'Student User', roleCode: 'STUDENT' },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const sequelize = queryInterface.sequelize;

    const userRows = USERS.map((u) => ({
      id: randomUUID(),
      mobile_number: u.mobileNumber,
      full_name: u.fullName,
      status: 'ACTIVE',
      is_mobile_verified: true,
      is_email_verified: false,
      metadata: '{}',
      created_at: now,
      updated_at: now,
    }));
    await queryInterface.bulkInsert('users', userRows);

    const roles = await sequelize.query('SELECT id, code FROM roles WHERE code IN (:codes)', {
      replacements: { codes: USERS.map((u) => u.roleCode) },
      type: QueryTypes.SELECT,
    });
    const roleIdByCode = Object.fromEntries(roles.map((r) => [r.code, r.id]));

    const userRoleRows = USERS.map((u, i) => ({
      user_id: userRows[i].id,
      role_id: roleIdByCode[u.roleCode],
      created_at: now,
    }));
    await queryInterface.bulkInsert('user_roles', userRoleRows);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE mobile_number IN (:numbers))",
      { replacements: { numbers: USERS.map((u) => u.mobileNumber) } },
    );
    await queryInterface.bulkDelete('users', { mobile_number: USERS.map((u) => u.mobileNumber) });
  },
};
