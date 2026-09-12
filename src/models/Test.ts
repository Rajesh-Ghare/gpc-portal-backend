import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class Test extends Model<InferAttributes<Test>, InferCreationAttributes<Test>> {
  declare id: CreationOptional<string>;
  declare competitiveExamId: string;
  declare testSeriesId: string | null;
  declare title: string;
  declare slug: string;
  declare description: string | null;
  declare instructions: string | null;
  declare status: CreationOptional<string>;
  declare testType: CreationOptional<string>;
  declare durationSeconds: number;
  declare totalQuestions: CreationOptional<number>;
  declare totalMarks: CreationOptional<string>;
  declare passingMarks: string | null;
  declare defaultMarksPerQuestion: CreationOptional<string>;
  declare defaultNegativeMarks: CreationOptional<string>;
  declare selectionMode: CreationOptional<string>;
  declare randomizeQuestions: CreationOptional<boolean>;
  declare randomizeOptions: CreationOptional<boolean>;
  declare attemptPolicy: CreationOptional<string>;
  declare resultVisibility: CreationOptional<string>;
  declare showScore: CreationOptional<boolean>;
  declare showCorrectAnswers: CreationOptional<boolean>;
  declare showExplanations: CreationOptional<boolean>;
  declare showRank: CreationOptional<boolean>;
  declare showPercentile: CreationOptional<boolean>;
  declare availableFrom: Date | null;
  declare availableUntil: Date | null;
  declare requiredLanguages: CreationOptional<string[]>;
  declare metadata: CreationOptional<Record<string, unknown>>;
  declare version: CreationOptional<number>;
  declare createdBy: string;
  declare updatedBy: string | null;
  declare publishedAt: Date | null;
  declare publishedBy: string | null;
  declare closedAt: Date | null;
  declare closedBy: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  static associate(models: {
    CompetitiveExam: typeof import('./CompetitiveExam').CompetitiveExam;
    TestSeries: typeof import('./TestSeries').TestSeries;
    TestSection: typeof import('./TestSection').TestSection;
    TestQuestion: typeof import('./TestQuestion').TestQuestion;
    TestRule: typeof import('./TestRule').TestRule;
  }) {
    Test.belongsTo(models.CompetitiveExam, { foreignKey: 'competitiveExamId', as: 'competitiveExam' });
    Test.belongsTo(models.TestSeries, { foreignKey: 'testSeriesId', as: 'testSeries' });
    Test.hasMany(models.TestSection, { foreignKey: 'testId', as: 'sections' });
    Test.hasMany(models.TestQuestion, { foreignKey: 'testId', as: 'testQuestions' });
    Test.hasMany(models.TestRule, { foreignKey: 'testId', as: 'testRules' });
  }
}

export function initTest(sequelize: Sequelize) {
  Test.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      competitiveExamId: { type: DataTypes.UUID, allowNull: false },
      testSeriesId: { type: DataTypes.UUID, allowNull: true },
      title: { type: DataTypes.STRING(200), allowNull: false },
      slug: { type: DataTypes.STRING(220), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      instructions: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'DRAFT' },
      testType: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'MOCK' },
      durationSeconds: { type: DataTypes.INTEGER, allowNull: false },
      totalQuestions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      totalMarks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      passingMarks: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      defaultMarksPerQuestion: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 1 },
      defaultNegativeMarks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      selectionMode: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'MANUAL' },
      randomizeQuestions: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      randomizeOptions: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      attemptPolicy: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'SINGLE' },
      resultVisibility: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'IMMEDIATE' },
      showScore: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      showCorrectAnswers: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      showExplanations: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      showRank: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      showPercentile: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      availableFrom: { type: DataTypes.DATE, allowNull: true },
      availableUntil: { type: DataTypes.DATE, allowNull: true },
      requiredLanguages: { type: DataTypes.JSONB, allowNull: false, defaultValue: ['en'] },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      createdBy: { type: DataTypes.UUID, allowNull: false },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
      publishedAt: { type: DataTypes.DATE, allowNull: true },
      publishedBy: { type: DataTypes.UUID, allowNull: true },
      closedAt: { type: DataTypes.DATE, allowNull: true },
      closedBy: { type: DataTypes.UUID, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'tests',
      underscored: true,
      timestamps: true,
      paranoid: true,
    },
  );
}
