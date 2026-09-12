import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class RolePermission extends Model<InferAttributes<RolePermission>, InferCreationAttributes<RolePermission>> {
  declare roleId: string;
  declare permissionId: string;
  declare createdAt: CreationOptional<Date>;
}

export function initRolePermission(sequelize: Sequelize) {
  RolePermission.init(
    {
      roleId: { type: DataTypes.UUID, primaryKey: true },
      permissionId: { type: DataTypes.UUID, primaryKey: true },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'role_permissions',
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );
}
