'use strict';

const { randomUUID } = require('crypto');
const { QueryTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const sequelize = queryInterface.sequelize;

    const [exam] = await sequelize.query("SELECT id FROM competitive_exams WHERE slug = 'ssc-cgl'", {
      type: QueryTypes.SELECT,
    });
    const [admin] = await sequelize.query("SELECT id FROM users WHERE mobile_number = '9000000002'", {
      type: QueryTypes.SELECT,
    });
    const questions = await sequelize.query(
      `SELECT q.id AS question_id, qv.id AS version_id
       FROM questions q
       JOIN question_versions qv ON qv.question_id = q.id
       WHERE q.created_by = :adminId
       ORDER BY q.created_at ASC`,
      { replacements: { adminId: admin.id }, type: QueryTypes.SELECT },
    );

    const testId = randomUUID();
    await queryInterface.bulkInsert('tests', [
      {
        id: testId,
        competitive_exam_id: exam.id,
        title: 'SSC CGL Quantitative Aptitude — Sample Mock Test',
        slug: 'ssc-cgl-quant-sample-mock',
        description: 'A sample mock test covering Percentage and Profit & Loss.',
        instructions: 'Each question carries 1 mark. There is a negative marking of 0.25 for each wrong answer.',
        status: 'PUBLISHED',
        test_type: 'MOCK',
        duration_seconds: 1800,
        total_questions: questions.length,
        total_marks: questions.length * 1.0,
        default_marks_per_question: 1.0,
        default_negative_marks: 0.25,
        selection_mode: 'MANUAL',
        randomize_questions: false,
        randomize_options: false,
        attempt_policy: 'MULTIPLE',
        result_visibility: 'IMMEDIATE',
        show_score: true,
        show_correct_answers: true,
        show_explanations: true,
        show_rank: false,
        show_percentile: false,
        required_languages: JSON.stringify(['en']),
        metadata: '{}',
        version: 1,
        created_by: admin.id,
        published_at: now,
        published_by: admin.id,
        created_at: now,
        updated_at: now,
      },
    ]);

    const sectionId = randomUUID();
    await queryInterface.bulkInsert('test_sections', [
      {
        id: sectionId,
        test_id: testId,
        title: 'Quantitative Aptitude',
        display_order: 1,
        question_count: questions.length,
        total_marks: questions.length * 1.0,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert(
      'test_questions',
      questions.map((q, i) => ({
        id: randomUUID(),
        test_id: testId,
        section_id: sectionId,
        question_id: q.question_id,
        question_version_id: q.version_id,
        display_order: i + 1,
        marks: 1.0,
        negative_marks: 0.25,
        created_at: now,
      })),
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM test_questions WHERE test_id IN (SELECT id FROM tests WHERE slug = 'ssc-cgl-quant-sample-mock');
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM test_sections WHERE test_id IN (SELECT id FROM tests WHERE slug = 'ssc-cgl-quant-sample-mock');
    `);
    await queryInterface.bulkDelete('tests', { slug: 'ssc-cgl-quant-sample-mock' });
  },
};
