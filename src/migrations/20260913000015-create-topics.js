'use strict';

const { DataTypes } = require('sequelize');
const { uuidPk, timestamps, uuidRef } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('topics', {
      ...uuidPk(),
      subject_id: uuidRef('subjects', { onDelete: 'CASCADE' }),
      parent_topic_id: uuidRef('topics', { allowNull: true, onDelete: 'CASCADE' }),
      name: { type: DataTypes.STRING(150), allowNull: false },
      slug: { type: DataTypes.STRING(180), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps({ paranoid: true }),
    });

    await queryInterface.addIndex('topics', ['subject_id']);
    await queryInterface.addIndex('topics', ['parent_topic_id']);
    await queryInterface.addIndex('topics', ['subject_id', 'slug'], {
      unique: true,
      name: 'topics_subject_id_slug_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('topics');
  },
};
