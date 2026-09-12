import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class PaymentWebhookEvent extends Model<
  InferAttributes<PaymentWebhookEvent>,
  InferCreationAttributes<PaymentWebhookEvent>
> {
  declare id: CreationOptional<string>;
  declare provider: string;
  declare providerEventId: string;
  declare eventType: string;
  declare payload: CreationOptional<Record<string, unknown>>;
  declare processedAt: Date | null;
  declare status: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
}

export function initPaymentWebhookEvent(sequelize: Sequelize) {
  PaymentWebhookEvent.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      provider: { type: DataTypes.STRING(30), allowNull: false },
      providerEventId: { type: DataTypes.STRING(255), allowNull: false },
      eventType: { type: DataTypes.STRING(50), allowNull: false },
      payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      processedAt: { type: DataTypes.DATE, allowNull: true },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'RECEIVED' },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'payment_webhook_events',
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );
}
