'use strict';
const MongoError = require('../error').MongoError;

function makeCryptCommand(command) {
  return function cryptCommand(server, ns, cmd, options, callback) {
    if (typeof options === 'function') (callback = options), (options = {});
    options = options || {};
    const autoEncrypter = server.s.options.autoEncrypter;
    const shouldBypassAutoEncryption = !!server.s.options.bypassAutoEncryption;

    if (cmd == null) {
      callback(new MongoError(`command ${JSON.stringify(cmd)} does not return a cursor`));
      return;
    }

    if (shouldBypassAutoEncryption) {
      command(server, ns, cmd, options, commandResponseHandler);
      return;
    }

    function commandResponseHandler(err, response) {
      if (err || response == null) {
        callback(err, response);
        return;
      }

      autoEncrypter.decrypt(response.result, (err, decrypted) => {
        if (err) {
          callback(err, null);
          return;
        }

        response.result = decrypted;
        response.message.documents = [decrypted];
        callback(null, response);
      });
    }

    autoEncrypter.encrypt(ns, cmd, (err, encrypted) => {
      if (err) {
        callback(err, null);
        return;
      }

      command(server, ns, encrypted, options, commandResponseHandler);
    });
  };
}

function isCryptEnabled(server) {
  return server && server.s && server.s.options && server.s.options.autoEncrypter;
}

module.exports = {
  makeCryptCommand,
  isCryptEnabled
};
