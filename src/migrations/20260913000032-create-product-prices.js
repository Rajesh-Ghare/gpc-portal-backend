'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('product_prices', {
      ...uuidPk(),
      product_id: uuidRef('products', { onDelete: 'CASCADE' }),
      currency_code: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      original_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      tax_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      valid_from: { type: DataTypes.DATE, allowNull: true },
      valid_until: { type: DataTypes.DATE, allowNull: true },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps(),
    });

    await queryInterface.addIndex('product_prices', ['product_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('product_prices');
  },
};
