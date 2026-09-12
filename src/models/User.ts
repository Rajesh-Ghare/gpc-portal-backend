import {
  BelongsToManyAddAssociationMixin,
  BelongsToManyGetAssociationsMixin,
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
  Sequelize,
} from 'sequelize';
import type { Role } from './Role';

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare mobileNumber: string;
  declare email: string | null;
  declare fullName: string | null;
  declare passwordHash: string | null;
  declare status: CreationOptional<string>;
  declare isMobileVerified: CreationOptional<boolean>;
  declare isEmailVerified: CreationOptional<boolean>;
  declare lastLoginAt: Date | null;
  declare metadata: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  declare roles?: NonAttribute<Role[]>;
  declare getRoles: BelongsToManyGetAssociationsMixin<Role>;
  declare addRole: BelongsToManyAddAssociationMixin<Role, string>;

  static associate(models: {
    Role: typeof import('./Role').Role;
    Session: typeof import('./Session').Session;
    UserRole: typeof import('./UserRole').UserRole;
  }) {
    User.belongsToMany(models.Role, {
      through: models.UserRole,
      foreignKey: 'userId',
      otherKey: 'roleId',
      as: 'roles',
    });
    User.hasMany(models.Session, { foreignKey: 'userId', as: 'sessions' });
  }
}

export function initUser(sequelize: Sequelize) {
  User.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      mobileNumber: { type: DataTypes.STRING(20), allowNull: false, unique: true },
      email: { type: DataTypes.STRING(255), allowNull: true, unique: true },
      fullName: { type: DataTypes.STRING(150), allowNull: true },
      passwordHash: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'ACTIVE' },
      isMobileVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      isEmailVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      lastLoginAt: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'users',
      underscored: true,
      timestamps: true,
      paranoid: true,
    },
  );
}
