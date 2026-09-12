'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('question_option_translations', {
      ...uuidPk(),
      question_option_id: uuidRef('question_options', { onDelete: 'CASCADE' }),
      language_code: { type: DataTypes.STRING(10), allowNull: false },
      option_text: { type: DataTypes.TEXT, allowNull: false },
      ...timestamps(),
    });

    await queryInterface.addIndex('question_option_translations', ['question_option_id', 'language_code'], {
      unique: true,
      name: 'question_option_translations_option_id_language_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('question_option_translations');
  },
};
