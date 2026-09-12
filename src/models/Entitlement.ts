import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class Entitlement extends Model<InferAttributes<Entitlement>, InferCreationAttributes<Entitlement>> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare productId: string;
  declare orderId: string | null;
  declare productItemId: string;
  declare status: CreationOptional<string>;
  declare attemptLimit: number | null;
  declare attemptsUsed: CreationOptional<number>;
  declare validFrom: Date | null;
  declare validUntil: Date | null;
  declare grantedBy: string | null;
  declare revokedAt: Date | null;
  declare metadata: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static associate(models: {
    User: typeof import('./User').User;
    Product: typeof import('./Product').Product;
    Order: typeof import('./Order').Order;
    ProductItem: typeof import('./ProductItem').ProductItem;
  }) {
    Entitlement.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Entitlement.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
    Entitlement.belongsTo(models.Order, { foreignKey: 'orderId', as: 'order' });
    Entitlement.belongsTo(models.ProductItem, { foreignKey: 'productItemId', as: 'productItem' });
  }
}

export function initEntitlement(sequelize: Sequelize) {
  Entitlement.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false },
      productId: { type: DataTypes.UUID, allowNull: false },
      orderId: { type: DataTypes.UUID, allowNull: true },
      productItemId: { type: DataTypes.UUID, allowNull: false },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVE' },
      attemptLimit: { type: DataTypes.INTEGER, allowNull: true },
      attemptsUsed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      validFrom: { type: DataTypes.DATE, allowNull: true },
      validUntil: { type: DataTypes.DATE, allowNull: true },
      grantedBy: { type: DataTypes.UUID, allowNull: true },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'entitlements',
      underscored: true,
      timestamps: true,
    },
  );
}
