import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class Session extends Model<InferAttributes<Session>, InferCreationAttributes<Session>> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare tokenHash: string;
  declare expiresAt: Date;
  declare revokedAt: Date | null;
  declare ipAddress: string | null;
  declare userAgent: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static associate(models: { User: typeof import('./User').User }) {
    Session.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  }
}

export function initSession(sequelize: Sequelize) {
  Session.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false },
      tokenHash: { type: DataTypes.TEXT, allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
      ipAddress: { type: DataTypes.STRING(45), allowNull: true },
      userAgent: { type: DataTypes.TEXT, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'sessions',
      underscored: true,
      timestamps: true,
    },
  );
}
