/**
 * microMVC+
 * A modern, zero-dependency JavaScript MVC micro-framework.
 *
 * Author  : Fabien Conéjéro
 * Version : 1.0.0
 * Date    : February 2026
 * License : MIT
 * Repository : https://github.com/madjeek-web
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.microMVC = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    'use strict';

    /**
     * ELEMENT
     *
     * The base object that every model, view, and controller element inherits from.
     * It knows its own id and which component it belongs to.
     * It can publish events upward to its component.
     *
     * --- For a 14-year-old ---
     * Think of an Element like a player in a team. Each player has a name (id),
     * knows which team they play for (component), and can shout things to the team.
     *
     * --- For a junior dev ---
     * Element is the base prototype for all registered MVC pieces.
     * It holds a reference to its parent Component and exposes publish shortcuts.
     *
     * --- For teachers and trainers ---
     * Element acts as the base mediator object. It is instantiated indirectly via
     * Component.add(). The _constructor hook replaces the native constructor to
     * allow deferred initialization after prototype assembly.
     */
    var Element = function () {};

    Element.prototype = {

        /**
         * _constructor
         * Called automatically after the element is built and registered.
         * Override this in your element definition to run setup code.
         */
        _constructor : function () {},

        /**
         * publish
         * Fires a namespaced event scoped to this element within its component.
         * The full context becomes : elementId.yourContext
         *
         * @param {string} context - Event name (e.g. "onLogin")
         * @param {object} event   - Data payload to send to subscribers
         */
        publish : function (context, event) {
            this._component.publish(this._id + '.' + context, event);
        },

        /**
         * publishAsync
         * Same as publish but deferred to the next event loop tick.
         * Returns a Promise so callers can chain or await.
         *
         * --- For a junior dev ---
         * Useful when you need to ensure the DOM has updated before notifying,
         * or when you want non-blocking fire-and-forget notifications.
         *
         * @param {string} context - Event name
         * @param {object} event   - Data payload
         * @returns {Promise}
         */
        publishAsync : function (context, event) {
            return this._component.publishAsync(this._id + '.' + context, event);
        },

        /**
         * destroy
         * Removes this element from its component.
         */
        destroy : function () {
            this._component.remove(this._id);
        }
    };


    /**
     * COMPONENT
     *
     * A container that holds elements (models, views, or controllers).
     * It manages the publish/subscribe messaging bus that allows all pieces to talk.
     *
     * --- For a 14-year-old ---
     * Think of a Component like a WhatsApp group chat. Anyone in the group
     * can send a message (publish) and anyone who subscribed will receive it.
     * You can also leave the group at any time (unsubscribe).
     *
     * --- For a junior dev ---
     * Component is a mediator. It holds a namespaced subscriber tree and fires
     * callbacks when matching contexts are published. It also serves as the
     * registry for all named elements.
     *
     * --- For teachers and trainers ---
     * The subscriber namespace is a plain recursive object tree, traversed by a
     * regex walker. Each node stores a _subscribers array. The publish method
     * walks the tree and invokes callbacks at each matching depth level.
     * This design allows hierarchical event bubbling with dot-notation scoping.
     */
    var Component = function (app) {
        this.__app__ = app;
        this.subscribers = {};
        this._log = [];
    };

    Component.prototype = {

        /**
         * add
         * Registers a new element inside this component.
         *
         * @param {string}   id  - Unique name for the element (e.g. "userModel")
         * @param {object}   obj - Object with the element's methods and properties
         * @param {function} ext - Optional base class to extend (default : Element)
         * @returns {object} The created element instance
         */
        add : function (id, obj, ext) {
            if (this.has(id)) {
                console.warn('microMVC : element "' + id + '" already exists. Returning existing instance.');
                return this[id];
            }

            ext = ext || Element;

            var element = function () {};
            element.prototype = new ext();
            element.prototype._id = id;
            element.prototype._component = this;
            element.prototype.controllers = this.__app__.controllers;
            element.prototype.models = this.__app__.models;
            element.prototype.views = this.__app__.views;

            for (var attr in obj) {
                if (obj.hasOwnProperty(attr)) {
                    element.prototype[attr] = obj[attr];
                }
            }

            this[id] = new element();
            this[id]._constructor();

            return this[id];
        },

        /**
         * has
         * Checks whether an element with the given id exists in this component.
         *
         * @param {string} id
         * @returns {boolean}
         */
        has : function (id) {
            return this[id] !== undefined && this[id] !== null;
        },

        /**
         * remove
         * Unregisters and deletes an element from this component.
         *
         * @param {string} id
         * @returns {Component} this (chainable)
         */
        remove : function (id) {
            if (!this.has(id)) {
                console.warn('microMVC : element "' + id + '" not found. Nothing to remove.');
                return this;
            }
            delete this[id];
            return this;
        },

        /**
         * call
         * Calls a method on a named element using dot-notation path.
         *
         * @param {string} path     - "elementId.methodName" (e.g. "userCtrl.login")
         * @param {*}      argument - Single argument passed to the method
         * @returns {*} The return value of the called method, or null
         */
        call : function (path, argument) {
            var match;
            if ((match = /^(.*?)\.(.*)$/.exec(path)) !== null) {
                var id = match[1];
                var method = match[2];
                if (this.has(id) && typeof this[id][method] === 'function') {
                    return this[id][method](argument);
                }
                console.warn('microMVC : call failed for "' + path + '". Check element id and method name.');
            }
            return null;
        },

        /**
         * publish
         * Fires an event on a dot-namespaced context.
         * All subscribers listening to any matching level of the namespace are called.
         *
         * @param {string} context - Namespaced event (e.g. "userModel.onLogin")
         * @param {object} event   - Data sent to subscribers
         * @returns {Component} this (chainable)
         */
        publish : function (context, event) {
            event = event || {};

            var re = new RegExp('[.]*([^.]+)[.]*', 'g');
            var m;
            var ns = this.subscribers;

            this._log.push({ time : Date.now(), context : context, event : event });

            while ((m = re.exec(context)) !== null && ns[m[1]]) {
                if (m.index === re.lastIndex) { re.lastIndex++; }
                ns = ns[m[1]];
                if (ns._subscribers) {
                    var toRemove = [];
                    for (var i = 0; i < ns._subscribers.length; i++) {
                        ns._subscribers[i].callback.call(ns._subscribers[i].scope, event);
                        if (ns._subscribers[i].once) {
                            toRemove.push(i);
                        }
                    }
                    for (var j = toRemove.length - 1; j >= 0; j--) {
                        ns._subscribers.splice(toRemove[j], 1);
                    }
                }
            }

            return this;
        },

        /**
         * publishAsync
         * Deferred version of publish. Returns a Promise.
         * Resolves once the event has been dispatched to all subscribers.
         *
         * @param {string} context
         * @param {object} event
         * @returns {Promise<{context, event}>}
         */
        publishAsync : function (context, event) {
            var self = this;
            return new Promise(function (resolve) {
                setTimeout(function () {
                    self.publish(context, event);
                    resolve({ context : context, event : event });
                }, 0);
            });
        },

        /**
         * subscribe
         * Listens to a namespaced event context. Callback fires every time it is published.
         *
         * @param {string}   context  - Namespaced event to listen to
         * @param {object}   scope    - The 'this' value inside the callback
         * @param {function} callback - Function called with the event payload
         * @returns {string} A unique subscription token (used to unsubscribe later)
         */
        subscribe : function (context, scope, callback) {
            return this._addSubscriber(context, scope, callback, false);
        },

        /**
         * once
         * Like subscribe but fires only once, then removes itself automatically.
         *
         * --- For a 14-year-old ---
         * It is like a one-time notification. You get the alert once, then it disappears.
         *
         * @param {string}   context
         * @param {object}   scope
         * @param {function} callback
         * @returns {string} Subscription token
         */
        once : function (context, scope, callback) {
            return this._addSubscriber(context, scope, callback, true);
        },

        /**
         * unsubscribe
         * Removes a subscription using its token returned by subscribe() or once().
         *
         * @param {string} token - The token returned by subscribe() or once()
         * @returns {Component} this (chainable)
         */
        unsubscribe : function (token) {
            this._removeByToken(this.subscribers, token);
            return this;
        },

        /**
         * getLog
         * Returns a copy of the event log for debugging purposes.
         *
         * @returns {Array} Array of logged publish calls
         */
        getLog : function () {
            return this._log.slice();
        },

        /**
         * clearLog
         * Empties the event log.
         *
         * @returns {Component} this (chainable)
         */
        clearLog : function () {
            this._log = [];
            return this;
        },

        /**
         * destroy
         * Wipes all subscribers and the event log from this component.
         *
         * @returns {Component} this (chainable)
         */
        destroy : function () {
            this.subscribers = {};
            this._log = [];
            return this;
        },

        /**
         * _addSubscriber (internal)
         * Registers a callback in the subscriber namespace tree.
         */
        _addSubscriber : function (context, scope, callback, isOnce) {
            var re = new RegExp('[.]*([^.]+)[.]*', 'g');
            var m;
            var ns = this.subscribers;

            while ((m = re.exec(context)) !== null) {
                if (m.index === re.lastIndex) { re.lastIndex++; }
                ns[m[1]] = ns[m[1]] || {};
                ns = ns[m[1]];
            }

            ns._subscribers = ns._subscribers || [];

            var token = 'sub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

            ns._subscribers.push({
                token    : token,
                context  : context,
                scope    : scope,
                callback : callback,
                once     : isOnce
            });

            return token;
        },

        /**
         * _removeByToken (internal)
         * Recursively searches the subscriber tree to remove a subscription by token.
         */
        _removeByToken : function (ns, token) {
            if (ns._subscribers) {
                for (var i = ns._subscribers.length - 1; i >= 0; i--) {
                    if (ns._subscribers[i].token === token) {
                        ns._subscribers.splice(i, 1);
                        return true;
                    }
                }
            }
            for (var key in ns) {
                if (key !== '_subscribers' && ns.hasOwnProperty(key)) {
                    if (this._removeByToken(ns[key], token)) { return true; }
                }
            }
            return false;
        }

    };


    /**
     * APPLICATION
     *
     * The root object. Holds the three components : controllers, views, models.
     * The models component has extra state management capabilities built in.
     *
     * --- For a 14-year-old ---
     * The Application is like the school itself. Inside there are three departments :
     * the teachers (controllers), the classrooms (views), and the library (models).
     * Everyone can talk to everyone through the school's messaging system.
     *
     * --- For a junior dev ---
     * Application wires the three Component instances together and patches the
     * models component with a simple key-value state store that publishes events
     * on every mutation, making reactive data binding trivial to implement.
     *
     * --- For teachers and trainers ---
     * The state store on models is intentionally kept outside of the Component
     * prototype to avoid coupling. It is added directly on the instance in the
     * Application constructor, following a flat composition preference
     * over deep inheritance chains.
     */
    var Application = function () {
        this.controllers = new Component(this);
        this.views       = new Component(this);
        this.models      = new Component(this);

        this._initModelState();
    };

    Application.prototype.VERSION = '1.0.0';

    /**
     * _initModelState (internal)
     * Patches the models component with reactive state management.
     * Uses closure to keep the state object private.
     */
    Application.prototype._initModelState = function () {
        var state = {};
        var models = this.models;

        /**
         * models.getState
         * Returns the current value for a key, or a full shallow copy of all state.
         *
         * @param {string} [key] - Optional key. If omitted, returns all state.
         * @returns {*}
         */
        models.getState = function (key) {
            if (key === undefined) {
                var copy = {};
                for (var k in state) {
                    if (state.hasOwnProperty(k)) { copy[k] = state[k]; }
                }
                return copy;
            }
            return state.hasOwnProperty(key) ? state[key] : undefined;
        };

        /**
         * models.setState
         * Updates a state key and publishes "state.changed" with old and new values.
         * Any view subscribed to "state.changed" will react automatically.
         *
         * @param {string} key
         * @param {*}      value
         * @returns {Component} models (chainable)
         */
        models.setState = function (key, value) {
            var previous = state[key];
            state[key] = value;
            models.publish('state.changed', {
                key      : key,
                value    : value,
                previous : previous
            });
            return models;
        };

        /**
         * models.resetState
         * Clears all state and publishes "state.reset".
         *
         * @returns {Component} models (chainable)
         */
        models.resetState = function () {
            state = {};
            models.publish('state.reset', {});
            return models;
        };
    };

    /**
     * destroy
     * Tears down the entire application : clears all components and state.
     * Useful for single-page app route transitions.
     *
     * @returns {Application} this (chainable)
     */
    Application.prototype.destroy = function () {
        this.controllers.destroy();
        this.views.destroy();
        this.models.destroy();
        this.models.resetState();
        return this;
    };

    return {
        Application : Application,
        VERSION     : '1.0.0'
    };

}));