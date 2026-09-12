'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('product_items', {
      ...uuidPk(),
      product_id: uuidRef('products', { onDelete: 'CASCADE' }),
      test_id: uuidRef('tests', { allowNull: true, onDelete: 'RESTRICT' }),
      test_series_id: uuidRef('test_series', { allowNull: true, onDelete: 'RESTRICT' }),
      competitive_exam_id: uuidRef('competitive_exams', { allowNull: true, onDelete: 'RESTRICT' }),
      subject_id: uuidRef('subjects', { allowNull: true, onDelete: 'RESTRICT' }),
      access_type: { type: DataTypes.STRING(30), allowNull: false },
      attempt_limit: { type: DataTypes.INTEGER, allowNull: true },
      access_duration_days: { type: DataTypes.INTEGER, allowNull: true },
      ...timestamps(),
    });

    await queryInterface.addIndex('product_items', ['product_id']);

    // Exactly one target column must be set, matching access_type — see
    // docs/COMMERCE_AND_PAYMENTS.md. SUBSCRIPTION/ALL_ACCESS need no target.
    await queryInterface.sequelize.query(`
      ALTER TABLE product_items ADD CONSTRAINT product_items_target_matches_access_type CHECK (
        (access_type = 'INDIVIDUAL_TEST' AND test_id IS NOT NULL AND test_series_id IS NULL AND competitive_exam_id IS NULL AND subject_id IS NULL) OR
        (access_type = 'TEST_SERIES' AND test_series_id IS NOT NULL AND test_id IS NULL AND competitive_exam_id IS NULL AND subject_id IS NULL) OR
        (access_type = 'EXAM_PACKAGE' AND competitive_exam_id IS NOT NULL AND test_id IS NULL AND test_series_id IS NULL AND subject_id IS NULL) OR
        (access_type = 'SUBJECT_PACKAGE' AND subject_id IS NOT NULL AND test_id IS NULL AND test_series_id IS NULL AND competitive_exam_id IS NULL) OR
        (access_type IN ('SUBSCRIPTION', 'ALL_ACCESS') AND test_id IS NULL AND test_series_id IS NULL AND competitive_exam_id IS NULL AND subject_id IS NULL)
      );
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('product_items');
  },
};
