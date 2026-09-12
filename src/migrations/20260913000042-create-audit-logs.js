'use strict';

const { DataTypes, literal } = require('sequelize');
const { uuidPk, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('audit_logs', {
      ...uuidPk(),
      actor_id: uuidRef('users', { allowNull: true, onDelete: 'SET NULL' }),
      action: { type: DataTypes.STRING(100), allowNull: false },
      entity_type: { type: DataTypes.STRING(50), allowNull: false },
      entity_id: { type: DataTypes.UUID, allowNull: true },
      before_data: { type: DataTypes.JSONB, allowNull: true },
      after_data: { type: DataTypes.JSONB, allowNull: true },
      ip_address: { type: DataTypes.STRING(45), allowNull: true },
      user_agent: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('audit_logs', ['entity_type', 'entity_id']);
    await queryInterface.addIndex('audit_logs', ['actor_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
  },
};
