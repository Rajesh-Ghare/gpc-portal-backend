'use strict';

const { DataTypes, literal } = require('sequelize');
const { uuidPk, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('result_details', {
      ...uuidPk(),
      result_id: uuidRef('results', { onDelete: 'CASCADE' }),
      attempt_question_id: uuidRef('attempt_questions', { onDelete: 'CASCADE' }),
      question_id: uuidRef('questions', { onDelete: 'RESTRICT' }),
      question_version_id: uuidRef('question_versions', { onDelete: 'RESTRICT' }),
      selected_option_id: uuidRef('question_options', { allowNull: true, onDelete: 'SET NULL' }),
      correct_option_id: uuidRef('question_options', { allowNull: true, onDelete: 'SET NULL' }),
      answer_status: { type: DataTypes.STRING(20), allowNull: false },
      marks_awarded: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      negative_marks_awarded: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      final_marks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      evaluator_type: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'AUTO' },
      evaluator_notes: { type: DataTypes.TEXT, allowNull: true },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('result_details', ['result_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('result_details');
  },
};
