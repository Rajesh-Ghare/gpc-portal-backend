import {
  BelongsToManySetAssociationsMixin,
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
  Sequelize,
} from 'sequelize';
import type { Tag } from './Tag';

export class Question extends Model<InferAttributes<Question>, InferCreationAttributes<Question>> {
  declare id: CreationOptional<string>;
  declare subjectId: string;
  declare topicId: string | null;
  declare questionType: CreationOptional<string>;
  declare difficulty: CreationOptional<string>;
  declare sourceType: CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare defaultLanguageCode: CreationOptional<string>;
  declare generatedByAi: CreationOptional<boolean>;
  declare aiProvider: string | null;
  declare aiModel: string | null;
  declare generationJobId: string | null;
  declare generationPromptVersion: string | null;
  declare generatedAt: Date | null;
  declare reviewStatus: CreationOptional<string>;
  declare reviewedBy: string | null;
  declare reviewedAt: Date | null;
  declare version: CreationOptional<number>;
  declare createdBy: string;
  declare updatedBy: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  declare tags?: NonAttribute<Tag[]>;
  declare setTags: BelongsToManySetAssociationsMixin<Tag, string>;

  static associate(models: {
    Subject: typeof import('./Subject').Subject;
    Topic: typeof import('./Topic').Topic;
    QuestionVersion: typeof import('./QuestionVersion').QuestionVersion;
    Tag: typeof import('./Tag').Tag;
    QuestionTag: typeof import('./QuestionTag').QuestionTag;
  }) {
    Question.belongsTo(models.Subject, { foreignKey: 'subjectId', as: 'subject' });
    Question.belongsTo(models.Topic, { foreignKey: 'topicId', as: 'topic' });
    Question.hasMany(models.QuestionVersion, { foreignKey: 'questionId', as: 'versions' });
    Question.belongsToMany(models.Tag, {
      through: models.QuestionTag,
      foreignKey: 'questionId',
      otherKey: 'tagId',
      as: 'tags',
    });
  }
}

export function initQuestion(sequelize: Sequelize) {
  Question.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      subjectId: { type: DataTypes.UUID, allowNull: false },
      topicId: { type: DataTypes.UUID, allowNull: true },
      questionType: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'MCQ_SINGLE' },
      difficulty: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'MEDIUM' },
      sourceType: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'MANUAL' },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'DRAFT' },
      defaultLanguageCode: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'en' },
      generatedByAi: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      aiProvider: { type: DataTypes.STRING(30), allowNull: true },
      aiModel: { type: DataTypes.STRING(100), allowNull: true },
      generationJobId: { type: DataTypes.UUID, allowNull: true },
      generationPromptVersion: { type: DataTypes.STRING(30), allowNull: true },
      generatedAt: { type: DataTypes.DATE, allowNull: true },
      reviewStatus: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING' },
      reviewedBy: { type: DataTypes.UUID, allowNull: true },
      reviewedAt: { type: DataTypes.DATE, allowNull: true },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      createdBy: { type: DataTypes.UUID, allowNull: false },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'questions',
      underscored: true,
      timestamps: true,
      paranoid: true,
    },
  );
}
