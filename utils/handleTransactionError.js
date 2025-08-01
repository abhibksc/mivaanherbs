// utils/handleTransactionError.js

module.exports = async function handleTransactionAbort(session, res, statusCode, message) {
  if (session?.inTransaction()) {
    await session.abortTransaction();
    session.endSession();
  }
  return res.status(statusCode).json({ error: message });
};
