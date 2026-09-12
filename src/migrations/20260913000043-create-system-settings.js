'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('system_settings', {
      ...uuidPk(),
      key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      value: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      description: { type: DataTypes.TEXT, allowNull: true },
      updated_by: uuidRef('users', { allowNull: true, onDelete: 'SET NULL' }),
      ...timestamps(),
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('system_settings');
  },
};
