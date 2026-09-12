'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('question_options', {
      ...uuidPk(),
      question_version_id: uuidRef('question_versions', { onDelete: 'CASCADE' }),
      option_key: { type: DataTypes.STRING(10), allowNull: false },
      display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_correct: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      numeric_value: { type: DataTypes.DECIMAL(18, 4), allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      ...timestamps(),
    });

    await queryInterface.addIndex('question_options', ['question_version_id']);
    await queryInterface.addIndex('question_options', ['question_version_id', 'option_key'], {
      unique: true,
      name: 'question_options_version_id_option_key_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('question_options');
  },
};
