(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./physics'), require('./world'));
  } else {
    root.importScripts('physics.js', 'world.js');
    const api = factory(root.NoteworthyPhysics, root.NoteworthyWorld);
    root.addEventListener('message', event => root.postMessage(api.dispatch(event.data)));
  }
})(typeof self === 'object' ? self : this, function (physics, world) {
  'use strict';
  function dispatch(message) {
    const requestId = message?.requestId ?? null;
    try {
      if (!message || typeof message !== 'object') throw new Error('A simulation request is required');
      let result;
      if (message.operation === 'observations') result = world.observations(physics, message.scenarioId, message.options);
      else if (message.operation === 'run') result = physics.run(message.state, message.options);
      else if (message.operation === 'replay') result = physics.replay(message.config, message.options);
      else if (message.operation === 'ensemble') result = physics.ensemble(message.config, message.variants, message.options);
      else throw new Error('Unknown simulation operation');
      return { requestId, result };
    } catch (error) {
      return { requestId, error: error instanceof Error ? error.message : 'The simulation request could not be completed' };
    }
  }
  return { dispatch };
});
