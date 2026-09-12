'use strict';

const { DataTypes, literal } = require('sequelize');
const { uuidPk, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('question_versions', {
      ...uuidPk(),
      question_id: uuidRef('questions', { onDelete: 'CASCADE' }),
      version_number: { type: DataTypes.INTEGER, allowNull: false },
      explanation: { type: DataTypes.TEXT, allowNull: true },
      solution_steps: { type: DataTypes.TEXT, allowNull: true },
      marks: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      negative_marks: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      created_by: uuidRef('users', { onDelete: 'RESTRICT' }),
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('question_versions', ['question_id', 'version_number'], {
      unique: true,
      name: 'question_versions_question_id_version_number_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('question_versions');
  },
};
