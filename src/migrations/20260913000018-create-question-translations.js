'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('question_translations', {
      ...uuidPk(),
      question_version_id: uuidRef('question_versions', { onDelete: 'CASCADE' }),
      language_code: { type: DataTypes.STRING(10), allowNull: false },
      question_text: { type: DataTypes.TEXT, allowNull: false },
      explanation: { type: DataTypes.TEXT, allowNull: true },
      solution_steps: { type: DataTypes.TEXT, allowNull: true },
      ...timestamps(),
    });

    await queryInterface.addIndex('question_translations', ['question_version_id', 'language_code'], {
      unique: true,
      name: 'question_translations_version_id_language_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('question_translations');
  },
};
