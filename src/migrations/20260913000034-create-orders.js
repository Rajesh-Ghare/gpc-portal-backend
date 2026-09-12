'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('orders', {
      ...uuidPk(),
      user_id: uuidRef('users', { onDelete: 'RESTRICT' }),
      order_number: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING' },
      currency_code: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
      subtotal_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      discount_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      tax_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      idempotency_key: { type: DataTypes.STRING(100), allowNull: false },
      paid_at: { type: DataTypes.DATE, allowNull: true },
      cancelled_at: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      ...timestamps(),
    });

    await queryInterface.addIndex('orders', ['user_id', 'idempotency_key'], {
      unique: true,
      name: 'orders_user_id_idempotency_key_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('orders');
  },
};
