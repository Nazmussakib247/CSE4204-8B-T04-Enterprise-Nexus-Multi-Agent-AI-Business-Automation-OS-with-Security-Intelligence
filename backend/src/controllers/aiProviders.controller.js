const { publicSettings, saveProviders } = require('../ai/providers');
const { writeAuditLog } = require('../utils/audit');

const getProviders = async (_req, res, next) => { try { res.json({ data: await publicSettings() }); } catch (error) { next(error); } };
const updateProviders = async (req, res, next) => {
  try {
    const providers = req.body?.providers;
    if (!Array.isArray(providers) || providers.length < 1 || providers.some((item) => !['gemini', 'groq'].includes(item.provider))) return res.status(400).json({ error: 'Valid provider settings are required' });
    if (providers.some((item) => ![1, 2].includes(Number(item.priority)))) return res.status(400).json({ error: 'Priority must be 1 or 2' });
    const data = await saveProviders(providers, req.user.id);
    writeAuditLog({ userId: req.user.id, action: 'admin.ai_provider.update', resourceType: 'ai_provider', metadata: { providers: providers.map(({ provider, enabled, priority, model, api_key }) => ({ provider, enabled, priority, model, key_updated: Boolean(api_key) })) }, req });
    res.json({ message: 'AI provider settings updated', data });
  } catch (error) { if (error.statusCode) return res.status(error.statusCode).json({ error: error.message }); next(error); }
};
module.exports = { getProviders, updateProviders };
