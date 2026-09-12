'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('order_items', {
      ...uuidPk(),
      order_id: uuidRef('orders', { onDelete: 'CASCADE' }),
      product_id: uuidRef('products', { onDelete: 'RESTRICT' }),
      product_item_id: uuidRef('product_items', { allowNull: true, onDelete: 'RESTRICT' }),
      // Snapshots taken at order time — never re-read live product data for a
      // placed order (see docs/COMMERCE_AND_PAYMENTS.md).
      product_name: { type: DataTypes.STRING(200), allowNull: false },
      unit_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      currency_code: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      subtotal_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      ...timestamps(),
    });

    await queryInterface.addIndex('order_items', ['order_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('order_items');
  },
};
