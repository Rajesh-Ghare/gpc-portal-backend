'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('subjects', {
      ...uuidPk(),
      name: { type: DataTypes.STRING(150), allowNull: false },
      slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps({ paranoid: true }),
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('subjects');
  },
};
