'use strict';

const { DataTypes, literal } = require('sequelize');
const { uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('test_rule_tags', {
      test_rule_id: { ...uuidRef('test_rules', { onDelete: 'CASCADE' }), primaryKey: true },
      tag_id: { ...uuidRef('tags', { onDelete: 'CASCADE' }), primaryKey: true },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('test_rule_tags');
  },
};
