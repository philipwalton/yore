var parseUrl = require('./parse-url');

function Yore() {

  if (window.history.state) {
    this.currentPage = window.history.state;
  }
  else {
    // Store the current url information.
    this.currentPage = parseUrl(window.location.href);
    this.currentPage.title = document.title;

    // Add history state initially so the first `popstate` event contains data.
    history.replaceState(
        this.currentPage,
        this.currentPage.title,
        this.currentPage.href);
  }

  this._queue = [];

  // Listen for popstate changes and log them.
  window.addEventListener('popstate', function(event) {
    var state = event.state;
    var title = state && state.title;
    this.add(window.location.href, title, state, event);
  }.bind(this));
}


Yore.prototype.add = function(url, title, state, event) {

  // Ignore urls pointing to the current address
  if (url == this.currentPage.href) return;

  this.nextPage = parseUrl(url);
  this.nextPage.title = title;
  this.nextPage.state = state;

  // If path is different this resource
  // points to a different page.
  if (this.nextPage.path != this.currentPage.path) {
    this._processQueue(event);
  }
};


/**
 * Register a plugin with the Yore instance.
 * @param {Function(Yore, done)} - A plugin that runs some task and
 *     informs the next plugin in the queue when it's done.
 */
Yore.prototype.use = function(plugin) {
  this._queue.push(plugin);

  return this;
};

/**
 * Register a handler to catch any errors.
 * Note: In ES3 reserved words like "catch" couldn't be used as property names:
 * http://kangax.github.io/compat-table/es5/#Reserved_words_as_property_names
 * @param {Function(Error)} - The function to handle the error.
 */
Yore.prototype['catch'] = function(onError) {
  this._onError = onError;

  return this;
};


Yore.prototype._onError = function(error) {
  // Left blank so calling `_onError` never fails.
  console.error(error.stack);
};


Yore.prototype._onComplete = function(event) {

  // Popstate triggered navigation is already handled by the browser,
  // so we only add to the history in non-popstate cases.
  if (!(event && event.type == 'popstate')) {
    history.pushState(
        this.nextPage,
        this.nextPage.title,
        this.nextPage.href);
  }

  if (this.nextPage.title) document.title = this.nextPage.title;

  // Update the last url to the current url
  this.currentPage = this.nextPage;
  this.nextPage = null;
};


Yore.prototype._processQueue = function(event) {
  var self = this;
  var i = 0;

  (function next() {

    var plugin = self._queue[i++];
    var isSync = plugin && !plugin.length;

    if (!plugin) return self._onComplete(event);

    // The callback for async plugins.
    function done(error) {
      if (error) {
        self._onError(error);
      }
      else {
        next();
      }
    }

    try {
      plugin.apply(self, isSync ? [] : [done]);
    }
    catch(error) {
      return self._onError(error);
    }

    // Sync plugins are done by now and can immediately process
    // the next item in the queue.
    if (isSync) next();

  }());
};


module.exports = Yore;

