'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('tags', {
      ...uuidPk(),
      name: { type: DataTypes.STRING(100), allowNull: false },
      slug: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      tag_type: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'GENERAL' },
      ...timestamps(),
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tags');
  },
};
