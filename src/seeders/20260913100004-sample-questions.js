'use strict';

const { randomUUID } = require('crypto');
const { QueryTypes } = require('sequelize');

const QUESTIONS = [
  {
    topicSlug: 'percentage',
    text: 'What is 10% of 200?',
    options: [
      { key: 'A', text: '10', correct: false },
      { key: 'B', text: '20', correct: true },
      { key: 'C', text: '30', correct: false },
      { key: 'D', text: '40', correct: false },
    ],
  },
  {
    topicSlug: 'percentage',
    text: "A number is increased by 20% and then decreased by 20%. What is the net percentage change?",
    options: [
      { key: 'A', text: 'No change', correct: false },
      { key: 'B', text: '4% increase', correct: false },
      { key: 'C', text: '4% decrease', correct: true },
      { key: 'D', text: '20% decrease', correct: false },
    ],
  },
  {
    topicSlug: 'profit-and-loss',
    text: 'A shopkeeper buys an item for ₹80 and sells it for ₹100. What is the profit percentage?',
    options: [
      { key: 'A', text: '20%', correct: false },
      { key: 'B', text: '25%', correct: true },
      { key: 'C', text: '15%', correct: false },
      { key: 'D', text: '30%', correct: false },
    ],
  },
  {
    topicSlug: 'profit-and-loss',
    text: 'An article is sold at a loss of 10% for ₹450. What was its cost price?',
    options: [
      { key: 'A', text: '₹495', correct: false },
      { key: 'B', text: '₹500', correct: true },
      { key: 'C', text: '₹410', correct: false },
      { key: 'D', text: '₹550', correct: false },
    ],
  },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const sequelize = queryInterface.sequelize;

    const [subject] = await sequelize.query(
      "SELECT id FROM subjects WHERE slug = 'quantitative-aptitude'",
      { type: QueryTypes.SELECT },
    );
    const topics = await sequelize.query(
      "SELECT id, slug FROM topics WHERE slug IN ('percentage', 'profit-and-loss')",
      { type: QueryTypes.SELECT },
    );
    const topicIdBySlug = Object.fromEntries(topics.map((t) => [t.slug, t.id]));
    const [admin] = await sequelize.query(
      "SELECT id FROM users WHERE mobile_number = '9000000002'",
      { type: QueryTypes.SELECT },
    );

    for (const q of QUESTIONS) {
      const questionId = randomUUID();
      await queryInterface.bulkInsert('questions', [
        {
          id: questionId,
          subject_id: subject.id,
          topic_id: topicIdBySlug[q.topicSlug],
          question_type: 'MCQ_SINGLE',
          difficulty: 'MEDIUM',
          source_type: 'MANUAL',
          status: 'PUBLISHED',
          default_language_code: 'en',
          generated_by_ai: false,
          review_status: 'APPROVED',
          reviewed_by: admin.id,
          reviewed_at: now,
          version: 1,
          created_by: admin.id,
          created_at: now,
          updated_at: now,
        },
      ]);

      const versionId = randomUUID();
      await queryInterface.bulkInsert('question_versions', [
        {
          id: versionId,
          question_id: questionId,
          version_number: 1,
          marks: 1.0,
          negative_marks: 0.25,
          metadata: '{}',
          created_by: admin.id,
          created_at: now,
        },
      ]);

      await queryInterface.bulkInsert('question_translations', [
        {
          id: randomUUID(),
          question_version_id: versionId,
          language_code: 'en',
          question_text: q.text,
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert(
        'question_options',
        q.options.map((opt, i) => ({
          id: randomUUID(),
          question_version_id: versionId,
          option_key: opt.key,
          display_order: i + 1,
          is_correct: opt.correct,
          metadata: '{}',
          created_at: now,
          updated_at: now,
        })),
      );

      const options = await sequelize.query(
        'SELECT id, option_key FROM question_options WHERE question_version_id = :versionId',
        { replacements: { versionId }, type: QueryTypes.SELECT },
      );
      const optionIdByKey = Object.fromEntries(options.map((o) => [o.option_key, o.id]));

      await queryInterface.bulkInsert(
        'question_option_translations',
        q.options.map((opt) => ({
          id: randomUUID(),
          question_option_id: optionIdByKey[opt.key],
          language_code: 'en',
          option_text: opt.text,
          created_at: now,
          updated_at: now,
        })),
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM question_option_translations WHERE question_option_id IN (
        SELECT qo.id FROM question_options qo
        JOIN question_versions qv ON qv.id = qo.question_version_id
        JOIN questions q ON q.id = qv.question_id
        WHERE q.source_type = 'MANUAL' AND q.status = 'PUBLISHED'
          AND q.created_by = (SELECT id FROM users WHERE mobile_number = '9000000002')
      );
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM question_options WHERE question_version_id IN (
        SELECT qv.id FROM question_versions qv
        JOIN questions q ON q.id = qv.question_id
        WHERE q.created_by = (SELECT id FROM users WHERE mobile_number = '9000000002')
      );
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM question_translations WHERE question_version_id IN (
        SELECT qv.id FROM question_versions qv
        JOIN questions q ON q.id = qv.question_id
        WHERE q.created_by = (SELECT id FROM users WHERE mobile_number = '9000000002')
      );
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM question_versions WHERE question_id IN (
        SELECT id FROM questions WHERE created_by = (SELECT id FROM users WHERE mobile_number = '9000000002')
      );
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM questions WHERE created_by = (SELECT id FROM users WHERE mobile_number = '9000000002');
    `);
  },
};
