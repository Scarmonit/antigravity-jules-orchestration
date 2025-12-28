import Joi from 'joi';

const mcpExecuteSchema = Joi.object({
  tool: Joi.string().required(),
  parameters: Joi.object().unknown(true),
});

export default mcpExecuteSchema;
