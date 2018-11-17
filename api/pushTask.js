const registry = require('../helpers/registry');

// Push task to worker via registry
const pushTaskRoute = async (req, res, next) => {
  const { workerName } = req.params;

  try {
    const payload = req.body;

    await registry.pushTask(workerName, payload);
    res.status(200).json({ success: true });
  } catch (e) {
    next(e);
  }
};

module.exports = pushTaskRoute;
