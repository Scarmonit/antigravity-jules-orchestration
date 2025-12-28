import Joi from 'joi';

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // return all errors
      stripUnknown: true, // remove unknown properties
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        message: detail.message,
        path: detail.path,
      }));
      return res.status(400).json({ errors });
    }

    req.body = value;
    next();
  };
};

export default validateRequest;
