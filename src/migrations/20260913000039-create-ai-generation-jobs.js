'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('ai_generation_jobs', {
      ...uuidPk(),
      requested_by: uuidRef('users', { onDelete: 'RESTRICT' }),
      subject_id: uuidRef('subjects', { allowNull: true, onDelete: 'SET NULL' }),
      topic_id: uuidRef('topics', { allowNull: true, onDelete: 'SET NULL' }),
      competitive_exam_id: uuidRef('competitive_exams', { allowNull: true, onDelete: 'SET NULL' }),
      question_type: { type: DataTypes.STRING(30), allowNull: true },
      difficulty: { type: DataTypes.STRING(20), allowNull: true },
      language_code: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'en' },
      requested_count: { type: DataTypes.INTEGER, allowNull: false },
      generated_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      approved_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      failed_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      provider: { type: DataTypes.STRING(30), allowNull: false },
      model: { type: DataTypes.STRING(100), allowNull: true },
      prompt_version: { type: DataTypes.STRING(30), allowNull: true },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING' },
      error_message: { type: DataTypes.TEXT, allowNull: true },
      started_at: { type: DataTypes.DATE, allowNull: true },
      completed_at: { type: DataTypes.DATE, allowNull: true },
      configuration: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      ...timestamps(),
    });

    await queryInterface.addIndex('ai_generation_jobs', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ai_generation_jobs');
  },
};
