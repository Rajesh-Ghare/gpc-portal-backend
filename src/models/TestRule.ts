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

export class TestRule extends Model<InferAttributes<TestRule>, InferCreationAttributes<TestRule>> {
  declare id: CreationOptional<string>;
  declare testId: string;
  declare sectionId: string | null;
  declare subjectId: string | null;
  declare topicId: string | null;
  declare questionType: string | null;
  declare difficulty: string | null;
  declare languageCode: string | null;
  declare questionCount: number;
  declare selectionStrategy: CreationOptional<string>;
  declare displayOrder: CreationOptional<number>;
  declare ruleConfig: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare tags?: NonAttribute<Tag[]>;
  declare setTags: BelongsToManySetAssociationsMixin<Tag, string>;

  static associate(models: {
    Test: typeof import('./Test').Test;
    TestSection: typeof import('./TestSection').TestSection;
    Subject: typeof import('./Subject').Subject;
    Topic: typeof import('./Topic').Topic;
    Tag: typeof import('./Tag').Tag;
    TestRuleTag: typeof import('./TestRuleTag').TestRuleTag;
  }) {
    TestRule.belongsTo(models.Test, { foreignKey: 'testId', as: 'test' });
    TestRule.belongsTo(models.TestSection, { foreignKey: 'sectionId', as: 'section' });
    TestRule.belongsTo(models.Subject, { foreignKey: 'subjectId', as: 'subject' });
    TestRule.belongsTo(models.Topic, { foreignKey: 'topicId', as: 'topic' });
    TestRule.belongsToMany(models.Tag, {
      through: models.TestRuleTag,
      foreignKey: 'testRuleId',
      otherKey: 'tagId',
      as: 'tags',
    });
  }
}

export function initTestRule(sequelize: Sequelize) {
  TestRule.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      testId: { type: DataTypes.UUID, allowNull: false },
      sectionId: { type: DataTypes.UUID, allowNull: true },
      subjectId: { type: DataTypes.UUID, allowNull: true },
      topicId: { type: DataTypes.UUID, allowNull: true },
      questionType: { type: DataTypes.STRING(30), allowNull: true },
      difficulty: { type: DataTypes.STRING(20), allowNull: true },
      languageCode: { type: DataTypes.STRING(10), allowNull: true },
      questionCount: { type: DataTypes.INTEGER, allowNull: false },
      selectionStrategy: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'RANDOM' },
      displayOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ruleConfig: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'test_rules',
      underscored: true,
      timestamps: true,
    },
  );
}
