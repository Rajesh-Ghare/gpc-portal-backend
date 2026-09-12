'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('questions', {
      ...uuidPk(),
      subject_id: uuidRef('subjects', { onDelete: 'RESTRICT' }),
      topic_id: uuidRef('topics', { allowNull: true, onDelete: 'SET NULL' }),
      question_type: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'MCQ_SINGLE' },
      difficulty: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'MEDIUM' },
      source_type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'MANUAL' },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'DRAFT' },
      default_language_code: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'en' },
      generated_by_ai: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      ai_provider: { type: DataTypes.STRING(30), allowNull: true },
      ai_model: { type: DataTypes.STRING(100), allowNull: true },
      // No FK yet: ai_generation_jobs is created later in the migration order
      // (spec section 20). A follow-up migration adds the FK constraint once
      // that table exists.
      generation_job_id: { type: DataTypes.UUID, allowNull: true },
      generation_prompt_version: { type: DataTypes.STRING(30), allowNull: true },
      generated_at: { type: DataTypes.DATE, allowNull: true },
      review_status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING' },
      reviewed_by: uuidRef('users', { allowNull: true, onDelete: 'SET NULL' }),
      reviewed_at: { type: DataTypes.DATE, allowNull: true },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      created_by: uuidRef('users', { onDelete: 'RESTRICT' }),
      updated_by: uuidRef('users', { allowNull: true, onDelete: 'SET NULL' }),
      ...timestamps({ paranoid: true }),
    });

    await queryInterface.addIndex('questions', ['subject_id']);
    await queryInterface.addIndex('questions', ['topic_id']);
    await queryInterface.addIndex('questions', ['status']);
    await queryInterface.addIndex('questions', ['review_status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('questions');
  },
};
