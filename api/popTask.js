const registry = require('../helpers/registry');

// Pop task for `workerName` from registry
const popTaskRoute = async (req, res, next) => {
  const { workerName } = req.params;

  try {
    const task = await registry.popTask(workerName);

    if (task) {
      res.status(200).json({ task });
    } else {
      // Return `202 Accepted` when no tasks are available
      res.status(202).json({ error: 'No tasks available' });
    }
  } catch (e) {
    next(e);
  }
};

module.exports = popTaskRoute;
