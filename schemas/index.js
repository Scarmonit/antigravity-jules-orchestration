import Joi from 'joi';

export const schemas = {
  'mcp-execute': Joi.object({
    tool: Joi.string().required(),
    parameters: Joi.object().optional(),
  }),
  'session-create': Joi.object({
    prompt: Joi.string().min(10).max(10000).required(),
    source: Joi.string().pattern(/^sources\/github\/[^/]+\/[^/]+$/).required(),
    branch: Joi.string().max(255).optional(),
    title: Joi.string().max(255).optional(),
    requirePlanApproval: Joi.boolean().optional(),
    automationMode: Joi.string().valid('AUTO_CREATE_PR', 'NONE').optional(),
  }),
};
