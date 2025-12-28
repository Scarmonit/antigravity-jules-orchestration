import { schemas } from '../schemas/index.js';

export function validateRequest(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return res.status(500).json({ error: `Schema '${schemaName}' not found.` });
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessages = error.details.map((detail) => detail.message);
      return res.status(400).json({
        error: 'Validation failed',
        messages: errorMessages,
      });
    }

    req.body = value;
    next();
  };
}
