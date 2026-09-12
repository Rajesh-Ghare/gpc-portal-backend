'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('results', {
      ...uuidPk(),
      attempt_id: { ...uuidRef('attempts', { onDelete: 'CASCADE' }), unique: true },
      user_id: uuidRef('users', { onDelete: 'RESTRICT' }),
      test_id: uuidRef('tests', { onDelete: 'RESTRICT' }),
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING' },
      total_questions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      attempted_questions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      correct_answers: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      incorrect_answers: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      unanswered_questions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      total_marks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      scored_marks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      negative_marks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      accuracy_percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      time_taken_seconds: { type: DataTypes.INTEGER, allowNull: true },
      rank: { type: DataTypes.INTEGER, allowNull: true },
      percentile: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      evaluated_at: { type: DataTypes.DATE, allowNull: true },
      released_at: { type: DataTypes.DATE, allowNull: true },
      evaluated_by: uuidRef('users', { allowNull: true, onDelete: 'SET NULL' }),
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      ...timestamps(),
    });

    await queryInterface.addIndex('results', ['test_id']);
    await queryInterface.addIndex('results', ['user_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('results');
  },
};
