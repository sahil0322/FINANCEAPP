// Without this, every controller needs try/catch
// With this, errors automatically flow to Express error middleware
const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    next(error); // passes to global error handler in app.js
  }
};

export { asyncHandler };