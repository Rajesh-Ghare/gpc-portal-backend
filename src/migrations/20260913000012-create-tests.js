'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('tests', {
      ...uuidPk(),
      competitive_exam_id: uuidRef('competitive_exams', { onDelete: 'RESTRICT' }),
      test_series_id: uuidRef('test_series', { allowNull: true, onDelete: 'SET NULL' }),
      title: { type: DataTypes.STRING(200), allowNull: false },
      slug: { type: DataTypes.STRING(220), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      instructions: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'DRAFT' },
      test_type: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'MOCK' },
      duration_seconds: { type: DataTypes.INTEGER, allowNull: false },
      total_questions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      total_marks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      passing_marks: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      default_marks_per_question: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 1 },
      default_negative_marks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      selection_mode: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'MANUAL' },
      randomize_questions: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      randomize_options: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      attempt_policy: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'SINGLE' },
      result_visibility: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'IMMEDIATE' },
      show_score: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      show_correct_answers: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      show_explanations: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      show_rank: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      show_percentile: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      available_from: { type: DataTypes.DATE, allowNull: true },
      available_until: { type: DataTypes.DATE, allowNull: true },
      required_languages: { type: DataTypes.JSONB, allowNull: false, defaultValue: ['en'] },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      created_by: uuidRef('users', { onDelete: 'RESTRICT' }),
      updated_by: uuidRef('users', { allowNull: true, onDelete: 'SET NULL' }),
      published_at: { type: DataTypes.DATE, allowNull: true },
      published_by: uuidRef('users', { allowNull: true, onDelete: 'SET NULL' }),
      closed_at: { type: DataTypes.DATE, allowNull: true },
      closed_by: uuidRef('users', { allowNull: true, onDelete: 'SET NULL' }),
      ...timestamps({ paranoid: true }),
    });

    await queryInterface.addIndex('tests', ['competitive_exam_id']);
    await queryInterface.addIndex('tests', ['test_series_id']);
    await queryInterface.addIndex('tests', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tests');
  },
};
