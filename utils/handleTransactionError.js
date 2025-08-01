module.exports = async function handleTransactionAbort(session, res, statusCode, message) {
  try {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
  } catch (e) {
    console.error("Error during transaction abort:", e.message);
  } finally {
    session?.endSession();
  }

  return res.status(statusCode).json({ error: message });
};
