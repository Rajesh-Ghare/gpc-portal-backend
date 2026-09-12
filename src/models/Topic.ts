import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class Topic extends Model<InferAttributes<Topic>, InferCreationAttributes<Topic>> {
  declare id: CreationOptional<string>;
  declare subjectId: string;
  declare parentTopicId: string | null;
  declare name: string;
  declare slug: string;
  declare description: string | null;
  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  static associate(models: { Subject: typeof import('./Subject').Subject; Question: typeof import('./Question').Question }) {
    Topic.belongsTo(models.Subject, { foreignKey: 'subjectId', as: 'subject' });
    Topic.belongsTo(Topic, { foreignKey: 'parentTopicId', as: 'parentTopic' });
    Topic.hasMany(Topic, { foreignKey: 'parentTopicId', as: 'childTopics' });
    Topic.hasMany(models.Question, { foreignKey: 'topicId', as: 'questions' });
  }
}

export function initTopic(sequelize: Sequelize) {
  Topic.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      subjectId: { type: DataTypes.UUID, allowNull: false },
      parentTopicId: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      slug: { type: DataTypes.STRING(180), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'topics',
      underscored: true,
      timestamps: true,
      paranoid: true,
    },
  );
}
