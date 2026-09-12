'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('users', {
      ...uuidPk(),
      mobile_number: { type: DataTypes.STRING(20), allowNull: false, unique: true },
      email: { type: DataTypes.STRING(255), allowNull: true, unique: true },
      full_name: { type: DataTypes.STRING(150), allowNull: true },
      password_hash: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'ACTIVE' },
      is_mobile_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_email_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      last_login_at: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      ...timestamps({ paranoid: true }),
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
