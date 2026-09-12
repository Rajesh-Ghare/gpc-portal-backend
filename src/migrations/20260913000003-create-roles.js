'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('roles', {
      ...uuidPk(),
      code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      is_system_role: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      ...timestamps(),
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('roles');
  },
};
