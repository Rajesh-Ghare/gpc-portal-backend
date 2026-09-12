'use strict';

const { DataTypes, literal } = require('sequelize');
const { uuidPk } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('otp_requests', {
      ...uuidPk(),
      mobile_number: { type: DataTypes.STRING(20), allowNull: false },
      purpose: { type: DataTypes.STRING(30), allowNull: false },
      otp_hash: { type: DataTypes.TEXT, allowNull: false },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      verified_at: { type: DataTypes.DATE, allowNull: true },
      attempt_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      request_ip: { type: DataTypes.STRING(45), allowNull: true },
      provider: { type: DataTypes.STRING(30), allowNull: false },
      provider_request_id: { type: DataTypes.STRING(255), allowNull: true },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('otp_requests', ['mobile_number', 'purpose']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('otp_requests');
  },
};
