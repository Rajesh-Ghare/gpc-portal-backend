import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class Permission extends Model<InferAttributes<Permission>, InferCreationAttributes<Permission>> {
  declare id: CreationOptional<string>;
  declare code: string;
  declare name: string;
  declare module: string;
  declare description: string | null;
  declare createdAt: CreationOptional<Date>;

  static associate(models: {
    Role: typeof import('./Role').Role;
    RolePermission: typeof import('./RolePermission').RolePermission;
  }) {
    Permission.belongsToMany(models.Role, {
      through: models.RolePermission,
      foreignKey: 'permissionId',
      otherKey: 'roleId',
      as: 'roles',
    });
  }
}

export function initPermission(sequelize: Sequelize) {
  Permission.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      code: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      module: { type: DataTypes.STRING(50), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'permissions',
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );
}
