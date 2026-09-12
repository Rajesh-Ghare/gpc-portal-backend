import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class Payment extends Model<InferAttributes<Payment>, InferCreationAttributes<Payment>> {
  declare id: CreationOptional<string>;
  declare orderId: string;
  declare provider: string;
  declare providerPaymentId: string | null;
  declare providerOrderId: string | null;
  declare status: CreationOptional<string>;
  declare amount: string;
  declare currencyCode: CreationOptional<string>;
  declare method: string | null;
  declare rawResponse: CreationOptional<Record<string, unknown>>;
  declare paidAt: Date | null;
  declare failedAt: Date | null;
  declare metadata: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static associate(models: { Order: typeof import('./Order').Order }) {
    Payment.belongsTo(models.Order, { foreignKey: 'orderId', as: 'order' });
  }
}

export function initPayment(sequelize: Sequelize) {
  Payment.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      orderId: { type: DataTypes.UUID, allowNull: false },
      provider: { type: DataTypes.STRING(30), allowNull: false },
      providerPaymentId: { type: DataTypes.STRING(255), allowNull: true },
      providerOrderId: { type: DataTypes.STRING(255), allowNull: true },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING' },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      currencyCode: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
      method: { type: DataTypes.STRING(30), allowNull: true },
      rawResponse: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      paidAt: { type: DataTypes.DATE, allowNull: true },
      failedAt: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'payments',
      underscored: true,
      timestamps: true,
    },
  );
}
