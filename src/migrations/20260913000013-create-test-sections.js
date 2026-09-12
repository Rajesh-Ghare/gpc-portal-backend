'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('test_sections', {
      ...uuidPk(),
      test_id: uuidRef('tests', { onDelete: 'CASCADE' }),
      title: { type: DataTypes.STRING(150), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      question_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      total_marks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      duration_seconds: { type: DataTypes.INTEGER, allowNull: true },
      marks_per_question: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      negative_marks: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      ...timestamps(),
    });

    await queryInterface.addIndex('test_sections', ['test_id', 'display_order'], {
      unique: true,
      name: 'test_sections_test_id_display_order_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('test_sections');
  },
};
