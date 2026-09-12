'use strict';

const { DataTypes, literal } = require('sequelize');
const { uuidPk } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('payment_webhook_events', {
      ...uuidPk(),
      provider: { type: DataTypes.STRING(30), allowNull: false },
      provider_event_id: { type: DataTypes.STRING(255), allowNull: false },
      event_type: { type: DataTypes.STRING(50), allowNull: false },
      payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      processed_at: { type: DataTypes.DATE, allowNull: true },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'RECEIVED' },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('payment_webhook_events', ['provider', 'provider_event_id'], {
      unique: true,
      name: 'payment_webhook_events_provider_event_id_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payment_webhook_events');
  },
};
