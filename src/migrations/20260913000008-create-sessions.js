'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('sessions', {
      ...uuidPk(),
      user_id: uuidRef('users', { onDelete: 'CASCADE' }),
      token_hash: { type: DataTypes.TEXT, allowNull: false, unique: true },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      revoked_at: { type: DataTypes.DATE, allowNull: true },
      ip_address: { type: DataTypes.STRING(45), allowNull: true },
      user_agent: { type: DataTypes.TEXT, allowNull: true },
      ...timestamps(),
    });

    await queryInterface.addIndex('sessions', ['user_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sessions');
  },
};
