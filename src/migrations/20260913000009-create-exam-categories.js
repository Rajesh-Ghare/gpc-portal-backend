'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('exam_categories', {
      ...uuidPk(),
      name: { type: DataTypes.STRING(150), allowNull: false },
      slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      ...timestamps({ paranoid: true }),
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('exam_categories');
  },
};
