/**
 * Shared column helpers for migrations. Lives outside src/migrations/ on
 * purpose — sequelize-cli treats every file directly in that folder as a
 * migration (expects up/down exports), so shared code must live elsewhere.
 */
const { DataTypes, literal } = require('sequelize');

function uuidPk() {
  return {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: literal('gen_random_uuid()'),
    },
  };
}

function timestamps({ paranoid = false } = {}) {
  const cols = {
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: literal('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: literal('CURRENT_TIMESTAMP'),
    },
  };
  if (paranoid) {
    cols.deleted_at = { type: DataTypes.DATE, allowNull: true };
  }
  return cols;
}

function uuidRef(refTable, { allowNull = false, onDelete = 'RESTRICT' } = {}) {
  return {
    type: DataTypes.UUID,
    allowNull,
    references: { model: refTable, key: 'id' },
    onUpdate: 'CASCADE',
    onDelete,
  };
}

module.exports = { uuidPk, timestamps, uuidRef };
