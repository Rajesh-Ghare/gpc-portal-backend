import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class Order extends Model<InferAttributes<Order>, InferCreationAttributes<Order>> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare orderNumber: string;
  declare status: CreationOptional<string>;
  declare currencyCode: CreationOptional<string>;
  declare subtotalAmount: CreationOptional<string>;
  declare discountAmount: CreationOptional<string>;
  declare taxAmount: CreationOptional<string>;
  declare totalAmount: CreationOptional<string>;
  declare idempotencyKey: string;
  declare paidAt: Date | null;
  declare cancelledAt: Date | null;
  declare metadata: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static associate(models: {
    User: typeof import('./User').User;
    OrderItem: typeof import('./OrderItem').OrderItem;
    Payment: typeof import('./Payment').Payment;
  }) {
    Order.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Order.hasMany(models.OrderItem, { foreignKey: 'orderId', as: 'items' });
    Order.hasMany(models.Payment, { foreignKey: 'orderId', as: 'payments' });
  }
}

export function initOrder(sequelize: Sequelize) {
  Order.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false },
      orderNumber: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING' },
      currencyCode: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
      subtotalAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      discountAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      taxAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      totalAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      idempotencyKey: { type: DataTypes.STRING(100), allowNull: false },
      paidAt: { type: DataTypes.DATE, allowNull: true },
      cancelledAt: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'orders',
      underscored: true,
      timestamps: true,
    },
  );
}
