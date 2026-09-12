'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('attempt_answers', {
      ...uuidPk(),
      attempt_id: uuidRef('attempts', { onDelete: 'CASCADE' }),
      attempt_question_id: uuidRef('attempt_questions', { onDelete: 'CASCADE' }),
      selected_option_id: uuidRef('question_options', { allowNull: true, onDelete: 'SET NULL' }),
      answer_text: { type: DataTypes.TEXT, allowNull: true },
      numeric_answer: { type: DataTypes.DECIMAL(18, 4), allowNull: true },
      is_marked_for_review: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      answered_at: { type: DataTypes.DATE, allowNull: true },
      last_saved_at: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      ...timestamps(),
    });

    await queryInterface.addIndex('attempt_answers', ['attempt_id', 'attempt_question_id'], {
      unique: true,
      name: 'attempt_answers_attempt_id_attempt_question_id_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('attempt_answers');
  },
};
