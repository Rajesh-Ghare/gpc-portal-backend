import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class OtpRequest extends Model<InferAttributes<OtpRequest>, InferCreationAttributes<OtpRequest>> {
  declare id: CreationOptional<string>;
  declare mobileNumber: string;
  declare purpose: string;
  declare otpHash: string;
  declare expiresAt: Date;
  declare verifiedAt: Date | null;
  declare attemptCount: CreationOptional<number>;
  declare requestIp: string | null;
  declare provider: string;
  declare providerRequestId: string | null;
  declare createdAt: CreationOptional<Date>;
}

export function initOtpRequest(sequelize: Sequelize) {
  OtpRequest.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      mobileNumber: { type: DataTypes.STRING(20), allowNull: false },
      purpose: { type: DataTypes.STRING(30), allowNull: false },
      otpHash: { type: DataTypes.TEXT, allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      verifiedAt: { type: DataTypes.DATE, allowNull: true },
      attemptCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      requestIp: { type: DataTypes.STRING(45), allowNull: true },
      provider: { type: DataTypes.STRING(30), allowNull: false },
      providerRequestId: { type: DataTypes.STRING(255), allowNull: true },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'otp_requests',
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );
}
