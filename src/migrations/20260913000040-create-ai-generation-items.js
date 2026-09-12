'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('ai_generation_items', {
      ...uuidPk(),
      job_id: uuidRef('ai_generation_jobs', { onDelete: 'CASCADE' }),
      question_id: uuidRef('questions', { allowNull: true, onDelete: 'SET NULL' }),
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING' },
      raw_output: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      validation_errors: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      duplicate_match_question_id: uuidRef('questions', { allowNull: true, onDelete: 'SET NULL' }),
      reviewed_by: uuidRef('users', { allowNull: true, onDelete: 'SET NULL' }),
      reviewed_at: { type: DataTypes.DATE, allowNull: true },
      ...timestamps(),
    });

    await queryInterface.addIndex('ai_generation_items', ['job_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ai_generation_items');
  },
};
