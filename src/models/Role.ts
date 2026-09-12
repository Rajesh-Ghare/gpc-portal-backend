import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class Role extends Model<InferAttributes<Role>, InferCreationAttributes<Role>> {
  declare id: CreationOptional<string>;
  declare code: string;
  declare name: string;
  declare description: string | null;
  declare isSystemRole: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static associate(models: {
    User: typeof import('./User').User;
    Permission: typeof import('./Permission').Permission;
    UserRole: typeof import('./UserRole').UserRole;
    RolePermission: typeof import('./RolePermission').RolePermission;
  }) {
    Role.belongsToMany(models.User, {
      through: models.UserRole,
      foreignKey: 'roleId',
      otherKey: 'userId',
      as: 'users',
    });
    Role.belongsToMany(models.Permission, {
      through: models.RolePermission,
      foreignKey: 'roleId',
      otherKey: 'permissionId',
      as: 'permissions',
    });
  }
}

export function initRole(sequelize: Sequelize) {
  Role.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      isSystemRole: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'roles',
      underscored: true,
      timestamps: true,
    },
  );
}
