'use strict';

const { DataTypes, literal } = require('sequelize');
const { uuidPk, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('test_questions', {
      ...uuidPk(),
      test_id: uuidRef('tests', { onDelete: 'CASCADE' }),
      section_id: uuidRef('test_sections', { allowNull: true, onDelete: 'SET NULL' }),
      question_id: uuidRef('questions', { onDelete: 'RESTRICT' }),
      question_version_id: uuidRef('question_versions', { onDelete: 'RESTRICT' }),
      display_order: { type: DataTypes.INTEGER, allowNull: false },
      marks: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      negative_marks: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('test_questions', ['test_id', 'display_order'], {
      unique: true,
      name: 'test_questions_test_id_display_order_unique',
    });
    await queryInterface.addIndex('test_questions', ['test_id', 'question_id'], {
      unique: true,
      name: 'test_questions_test_id_question_id_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('test_questions');
  },
};
