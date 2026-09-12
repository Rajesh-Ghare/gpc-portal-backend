'use strict';

const { DataTypes, literal } = require('sequelize');
const { uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('role_permissions', {
      role_id: { ...uuidRef('roles', { onDelete: 'CASCADE' }), primaryKey: true },
      permission_id: { ...uuidRef('permissions', { onDelete: 'CASCADE' }), primaryKey: true },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('role_permissions');
  },
};
