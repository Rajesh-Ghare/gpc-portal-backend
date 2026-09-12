'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('competitive_exams', {
      ...uuidPk(),
      category_id: uuidRef('exam_categories', { onDelete: 'RESTRICT' }),
      name: { type: DataTypes.STRING(150), allowNull: false },
      slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
      code: { type: DataTypes.STRING(50), allowNull: true, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      conducting_body: { type: DataTypes.STRING(200), allowNull: true },
      official_website: { type: DataTypes.STRING(255), allowNull: true },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      ...timestamps({ paranoid: true }),
    });

    await queryInterface.addIndex('competitive_exams', ['category_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('competitive_exams');
  },
};
