'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('entitlements', {
      ...uuidPk(),
      user_id: uuidRef('users', { onDelete: 'RESTRICT' }),
      product_id: uuidRef('products', { onDelete: 'RESTRICT' }),
      order_id: uuidRef('orders', { allowNull: true, onDelete: 'SET NULL' }),
      product_item_id: uuidRef('product_items', { onDelete: 'RESTRICT' }),
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVE' },
      attempt_limit: { type: DataTypes.INTEGER, allowNull: true },
      attempts_used: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      valid_from: { type: DataTypes.DATE, allowNull: true },
      valid_until: { type: DataTypes.DATE, allowNull: true },
      granted_by: uuidRef('users', { allowNull: true, onDelete: 'SET NULL' }),
      revoked_at: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      ...timestamps(),
    });

    await queryInterface.addIndex('entitlements', ['user_id']);
    await queryInterface.addIndex('entitlements', ['user_id', 'product_item_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('entitlements');
  },
};
