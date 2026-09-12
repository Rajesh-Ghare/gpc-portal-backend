'use strict';

const { DataTypes, literal } = require('sequelize');
const { uuidPk } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('permissions', {
      ...uuidPk(),
      code: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      module: { type: DataTypes.STRING(50), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('permissions');
  },
};
