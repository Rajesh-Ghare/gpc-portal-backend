'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('test_series', {
      ...uuidPk(),
      competitive_exam_id: uuidRef('competitive_exams', { allowNull: true, onDelete: 'SET NULL' }),
      name: { type: DataTypes.STRING(150), allowNull: false },
      slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      thumbnail_url: { type: DataTypes.STRING(500), allowNull: true },
      display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      ...timestamps({ paranoid: true }),
    });

    await queryInterface.addIndex('test_series', ['competitive_exam_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('test_series');
  },
};
