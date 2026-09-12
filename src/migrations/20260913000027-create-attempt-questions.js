'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('attempt_questions', {
      ...uuidPk(),
      attempt_id: uuidRef('attempts', { onDelete: 'CASCADE' }),
      question_id: uuidRef('questions', { onDelete: 'RESTRICT' }),
      question_version_id: uuidRef('question_versions', { onDelete: 'RESTRICT' }),
      section_id: uuidRef('test_sections', { allowNull: true, onDelete: 'SET NULL' }),
      sequence_number: { type: DataTypes.INTEGER, allowNull: false },
      marks: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      negative_marks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      visited_at: { type: DataTypes.DATE, allowNull: true },
      answered_at: { type: DataTypes.DATE, allowNull: true },
      marked_for_review: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      ...timestamps(),
    });

    await queryInterface.addIndex('attempt_questions', ['attempt_id', 'sequence_number'], {
      unique: true,
      name: 'attempt_questions_attempt_id_sequence_number_unique',
    });
    await queryInterface.addIndex('attempt_questions', ['attempt_id', 'question_id'], {
      unique: true,
      name: 'attempt_questions_attempt_id_question_id_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('attempt_questions');
  },
};
