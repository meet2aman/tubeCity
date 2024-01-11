// by using try catch block
const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    res.status(error.code || 500).json({
      success: true,
      message: error.message,
    });
  }
};

// by using promises methods
// const asyncHandler2 = (fn) => {
//   return (req, res, next) => {
//     Promise.resolve(fn(req, res, next)).reject((error) => {
//       next(error);
//     });
//   };
// };

export { asyncHandler };
