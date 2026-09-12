import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class SystemSetting extends Model<InferAttributes<SystemSetting>, InferCreationAttributes<SystemSetting>> {
  declare id: CreationOptional<string>;
  declare key: string;
  declare value: CreationOptional<Record<string, unknown>>;
  declare description: string | null;
  declare updatedBy: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initSystemSetting(sequelize: Sequelize) {
  SystemSetting.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      value: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      description: { type: DataTypes.TEXT, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'system_settings',
      underscored: true,
      timestamps: true,
    },
  );
}
