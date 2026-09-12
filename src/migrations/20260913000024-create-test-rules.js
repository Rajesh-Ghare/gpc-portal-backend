'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('test_rules', {
      ...uuidPk(),
      test_id: uuidRef('tests', { onDelete: 'CASCADE' }),
      section_id: uuidRef('test_sections', { allowNull: true, onDelete: 'SET NULL' }),
      subject_id: uuidRef('subjects', { allowNull: true, onDelete: 'SET NULL' }),
      topic_id: uuidRef('topics', { allowNull: true, onDelete: 'SET NULL' }),
      question_type: { type: DataTypes.STRING(30), allowNull: true },
      difficulty: { type: DataTypes.STRING(20), allowNull: true },
      language_code: { type: DataTypes.STRING(10), allowNull: true },
      question_count: { type: DataTypes.INTEGER, allowNull: false },
      selection_strategy: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'RANDOM' },
      display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      rule_config: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      ...timestamps(),
    });

    await queryInterface.addIndex('test_rules', ['test_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('test_rules');
  },
};
