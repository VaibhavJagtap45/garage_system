const sendSuccess = (res, statusCode = 200, message, data = null) => {
  const response = {
    success: true,
    message,
  };

  if (data !== null) response.data = data;

  return res.status(statusCode).json(response);
};

const sendError = (res, statusCode = 500, message, errors = null) => {
  const response = {
    success: false,
    message,
  };

  if (errors !== null) response.errors = errors;

  return res.status(statusCode).json(response);
};

module.exports = { sendSuccess, sendError };
