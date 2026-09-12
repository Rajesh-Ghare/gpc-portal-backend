import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class OrderItem extends Model<InferAttributes<OrderItem>, InferCreationAttributes<OrderItem>> {
  declare id: CreationOptional<string>;
  declare orderId: string;
  declare productId: string;
  declare productItemId: string | null;
  declare productName: string;
  declare unitPrice: string;
  declare currencyCode: CreationOptional<string>;
  declare quantity: CreationOptional<number>;
  declare subtotalAmount: string;
  declare metadata: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static associate(models: {
    Order: typeof import('./Order').Order;
    Product: typeof import('./Product').Product;
    ProductItem: typeof import('./ProductItem').ProductItem;
  }) {
    OrderItem.belongsTo(models.Order, { foreignKey: 'orderId', as: 'order' });
    OrderItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
    OrderItem.belongsTo(models.ProductItem, { foreignKey: 'productItemId', as: 'productItem' });
  }
}

export function initOrderItem(sequelize: Sequelize) {
  OrderItem.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      orderId: { type: DataTypes.UUID, allowNull: false },
      productId: { type: DataTypes.UUID, allowNull: false },
      productItemId: { type: DataTypes.UUID, allowNull: true },
      productName: { type: DataTypes.STRING(200), allowNull: false },
      unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      currencyCode: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      subtotalAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'order_items',
      underscored: true,
      timestamps: true,
    },
  );
}
