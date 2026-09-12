'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('attempts', {
      ...uuidPk(),
      user_id: uuidRef('users', { onDelete: 'RESTRICT' }),
      test_id: uuidRef('tests', { onDelete: 'RESTRICT' }),
      attempt_number: { type: DataTypes.INTEGER, allowNull: false },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'IN_PROGRESS' },
      started_at: { type: DataTypes.DATE, allowNull: false },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      submitted_at: { type: DataTypes.DATE, allowNull: true },
      auto_submitted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      language_code: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'en' },
      total_questions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      total_marks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      ip_address: { type: DataTypes.STRING(45), allowNull: true },
      user_agent: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      ...timestamps(),
    });

    await queryInterface.addIndex('attempts', ['user_id', 'test_id', 'attempt_number'], {
      unique: true,
      name: 'attempts_user_id_test_id_attempt_number_unique',
    });

    // Partial unique index: at most one IN_PROGRESS attempt per user/test.
    await queryInterface.addIndex('attempts', ['user_id', 'test_id'], {
      unique: true,
      name: 'attempts_one_in_progress_per_user_test',
      where: { status: 'IN_PROGRESS' },
    });

    await queryInterface.addIndex('attempts', ['test_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('attempts');
  },
};
