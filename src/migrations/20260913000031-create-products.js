'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('products', {
      ...uuidPk(),
      name: { type: DataTypes.STRING(200), allowNull: false },
      slug: { type: DataTypes.STRING(220), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      product_type: { type: DataTypes.STRING(30), allowNull: false },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'DRAFT' },
      display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      created_by: uuidRef('users', { onDelete: 'RESTRICT' }),
      updated_by: uuidRef('users', { allowNull: true, onDelete: 'SET NULL' }),
      ...timestamps({ paranoid: true }),
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('products');
  },
};
