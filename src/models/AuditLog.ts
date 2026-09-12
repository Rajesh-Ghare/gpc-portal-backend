import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class AuditLog extends Model<InferAttributes<AuditLog>, InferCreationAttributes<AuditLog>> {
  declare id: CreationOptional<string>;
  declare actorId: string | null;
  declare action: string;
  declare entityType: string;
  declare entityId: string | null;
  declare beforeData: Record<string, unknown> | null;
  declare afterData: Record<string, unknown> | null;
  declare ipAddress: string | null;
  declare userAgent: string | null;
  declare metadata: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;

  static associate(models: { User: typeof import('./User').User }) {
    AuditLog.belongsTo(models.User, { foreignKey: 'actorId', as: 'actor' });
  }
}

export function initAuditLog(sequelize: Sequelize) {
  AuditLog.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      actorId: { type: DataTypes.UUID, allowNull: true },
      action: { type: DataTypes.STRING(100), allowNull: false },
      entityType: { type: DataTypes.STRING(50), allowNull: false },
      entityId: { type: DataTypes.UUID, allowNull: true },
      beforeData: { type: DataTypes.JSONB, allowNull: true },
      afterData: { type: DataTypes.JSONB, allowNull: true },
      ipAddress: { type: DataTypes.STRING(45), allowNull: true },
      userAgent: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'audit_logs',
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );
}
