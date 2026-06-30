const { query } = require('../config/db');

const HRModel = {
  create: async (data) => {
    const { rows } = await query(
      `INSERT INTO hr_reports
         (user_id, task_id, candidate_name, job_title, ai_score, confidence,
          recommendation, narrative_summary, score_breakdown, extracted_profile)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        data.userId, data.taskId, data.candidateName, data.jobTitle,
        data.aiScore, data.confidence, data.recommendation,
        data.narrativeSummary,
        JSON.stringify(data.scoreBreakdown || {}),
        JSON.stringify(data.extractedProfile || {}),
      ]
    );
    return rows[0];
  },

  findByUser: async (userId, { offset = 0, limit = 20 } = {}) => {
    const { rows } = await query(
      `SELECT * FROM hr_reports WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    const { rows: cnt } = await query(
      'SELECT COUNT(*) FROM hr_reports WHERE user_id = $1', [userId]
    );
    return { data: rows, total: parseInt(cnt[0].count) };
  },

  findById: async (id) => {
    const { rows } = await query('SELECT * FROM hr_reports WHERE id = $1', [id]);
    return rows[0] || null;
  },

  /**
   * Return all reports for a user sorted by ai_score DESC (batch ranking).
   */
  getBatchRankings: async (userId, { offset = 0, limit = 20 } = {}) => {
    const { rows } = await query(
      `SELECT id, candidate_name, job_title, ai_score, confidence, recommendation, created_at
       FROM hr_reports
       WHERE user_id = $1
       ORDER BY ai_score DESC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows;
  },
};

module.exports = HRModel;
