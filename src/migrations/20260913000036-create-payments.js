'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('payments', {
      ...uuidPk(),
      order_id: uuidRef('orders', { onDelete: 'CASCADE' }),
      provider: { type: DataTypes.STRING(30), allowNull: false },
      provider_payment_id: { type: DataTypes.STRING(255), allowNull: true },
      provider_order_id: { type: DataTypes.STRING(255), allowNull: true },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING' },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      currency_code: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
      method: { type: DataTypes.STRING(30), allowNull: true },
      raw_response: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      paid_at: { type: DataTypes.DATE, allowNull: true },
      failed_at: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      ...timestamps(),
    });

    await queryInterface.addIndex('payments', ['order_id']);
    await queryInterface.addIndex('payments', ['provider', 'provider_payment_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payments');
  },
};
