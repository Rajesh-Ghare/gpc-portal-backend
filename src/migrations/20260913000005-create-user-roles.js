'use strict';

const { DataTypes, literal } = require('sequelize');
const { uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('user_roles', {
      user_id: { ...uuidRef('users', { onDelete: 'CASCADE' }), primaryKey: true },
      role_id: { ...uuidRef('roles', { onDelete: 'CASCADE' }), primaryKey: true },
      assigned_by: uuidRef('users', { allowNull: true, onDelete: 'SET NULL' }),
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_roles');
  },
};
