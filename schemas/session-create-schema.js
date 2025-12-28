import Joi from 'joi';

const sessionCreateSchema = Joi.object({
  prompt: Joi.string().min(10).max(10000).required(),
  source: Joi.string().pattern(/^sources\\/github\\/[a-zA-Z0-9-]+\\/[a-zA-Z0-9-]+$/).required(),
  branch: Joi.string().max(100),
  title: Joi.string().max(200),
  requirePlanApproval: Joi.boolean(),
  automationMode: Joi.string().valid('AUTO_CREATE_PR', 'NONE'),
});

export default sessionCreateSchema;
