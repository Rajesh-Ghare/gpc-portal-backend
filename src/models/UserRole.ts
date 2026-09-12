import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class UserRole extends Model<InferAttributes<UserRole>, InferCreationAttributes<UserRole>> {
  declare userId: string;
  declare roleId: string;
  declare assignedBy: string | null;
  declare createdAt: CreationOptional<Date>;
}

export function initUserRole(sequelize: Sequelize) {
  UserRole.init(
    {
      userId: { type: DataTypes.UUID, primaryKey: true },
      roleId: { type: DataTypes.UUID, primaryKey: true },
      assignedBy: { type: DataTypes.UUID, allowNull: true },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'user_roles',
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );
}
