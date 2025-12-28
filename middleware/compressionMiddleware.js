import compression from 'compression';

const compressionMiddleware = () => {
  if (process.env.COMPRESSION_ENABLED !== 'true') {
    return (req, res, next) => next();
  }

  return compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        // don't compress responses with this header
        return false;
      }
      // fallback to standard filter function
      return compression.filter(req, res);
    },
    threshold: '1kb', // only compress responses > 1KB
  });
};

export default compressionMiddleware;
