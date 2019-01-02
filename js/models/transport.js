import fetch from 'isomorphic-fetch';

// TODO: set this via query param
const OFFLINE_MODE = true;

export default function (options) {

	options = options || {};

	return {

		cache: {},
		errorCache: {},
		MAX_NUM_RETRIES: options.maxNumRetries || 3,
		DEFAULT_EXPIRATION: options.expiration || 0,
		CACHE_KEY_URL_OPTIONS_DELIMITER: '--',

		/**
		 * Make a request via the fetch API.
		 * Supports response caching, but responses expire immediately by default;
		 * pass `requestOptions.expiration` (ms) to maintain responses in the cache
		 * or configure with `options.expiration` sent to `transport()`.
		 * 
		 * @param  {String} url             URL to `fetch`.
		 * @param  {Function} parser        Custom parser to apply to response; defaults to `fetch`'s `response.json()`
		 * @param  {Object} requestOptions  Options; some are passed to `fetch()`, like `headers`;
		 *                                  others are used internally, like `expiration` or `statusOnly`
		 * @return {Promise}                Promise that resolves with the parsed response,
		 *                                  or rejects with any error generated during fetch/parse.
		 *                                  NOTE: If request is already in-flight, returns a Promise that does not resolve nor reject.
		 *                                  This is designed to work with the Redux pattern:
		 *                                  any Actions duplicating in-flight requests fail silently,
		 *                                  and the one Action whose request is actually processed will trigger a store change and application update.
		 */
		request: function (url, parser, requestOptions) {

			requestOptions = requestOptions || {};
			requestOptions.expiration = typeof requestOptions.expiration === 'undefined' ? this.DEFAULT_EXPIRATION : requestOptions.expiration;

			if (!parser) {
				parser = this.parseJSON;
			}

			let cacheKey = this.deriveCacheKey(url ,requestOptions),
				returnVal = this.retrieveOrFetch(url, requestOptions, cacheKey),
				isWrite =
					requestOptions.method === 'POST' ||
					requestOptions.method === 'PUT' ||
					requestOptions.method === 'DELETE' ||
					requestOptions.method === 'PATCH';

			// duck-type instead of instanceof, to avoid problems with polyfills
			if (returnVal.then) {

				// fetching; return fetch+parse Promise chain
				return returnVal
				.then(this.dumpReqRsp(url))
				.then(this.checkStatus)
				.then(response => {
					return !requestOptions.statusOnly ? parser(response) : Promise.resolve(response);
				})
				.then(response => {
					return this.cacheResponse(cacheKey, response, isWrite);
				})
				.catch(error => {

					// Retry request if the server did not return a valid error message
					// and we're not yet out of retries
					let numTries = this.cacheError(cacheKey, error);
					if (!error.response && numTries < this.MAX_NUM_RETRIES) {
						// try again...
						console.warn(`Request failed on attempt ${ numTries } of ${ this.MAX_NUM_RETRIES } [url: ${ url } ]`);
						return this.request(url, parser, {
							...requestOptions,
							isRetry: true
						});
					} else {
						// i give up!

						// TODO: log to text file
						// TODO: email notifications
						console.error('Request failed:', error);

						throw error;
					}


				});

			} else {

				if (returnVal.responsePending) {

					// Actions duplicating already-in-flight requests
					// are returned an empty Promise that never resolves nor rejects.
					// Once the in-flight request resolves, it will trigger a store change
					// and application update, so it's safe to just let this action
					// fail silently.
					return new Promise((resolve, reject) => {});
					
				} else {

					// asynchronously return cached (already parsed) value wrapped in a Promise
					return new Promise((resolve, reject) => {
						setTimeout(() => {
							resolve(returnVal);
						}, 1);
					});

				}
				
			}


		},

		retrieveOrFetch: function (url, requestOptions, cacheKey) {

			let cached = this.cache[cacheKey],
				methodIsGet = !requestOptions || !requestOptions.method || requestOptions.method === 'GET',
				{ isRetry } = requestOptions;

			if (!isRetry && cached && methodIsGet && performance.now() - cached.time < requestOptions.expiration) {

				// return cached value immediately if it's not past the expiration date.
				// return cached value only for GET requests.
				return cached.value;

			} else {

				// fetch a new response,
				// and mark as in-flight to defend against rapid sequential requests
				this.cache[cacheKey] = {
					value: {
						responsePending: true
					},
					time: performance.now()
				};


				//
				// TESTING OFFLINE PROXY
				//
				/*
				const path = url.split('/');
				if (path.length > 5 && path[3] === 'orgs' && path[5] === 'repos') {
					const { offline } = require('./offline/proxy');
					return offline(url);
				}
				else {
					return fetch(url, requestOptions);
				}
				*/

				// mock requests for offline development
				if (OFFLINE_MODE) {
					const { offline } = require('./offline/proxy');
					return offline(url);

					// Dynamic import syntax not working (404s on filename?)
					/*
					import('./offline-proxy.js')
						.then(({offline}) =>
							fetch(offline(url), requestOptions));
					*/
				}
				return fetch(url, requestOptions);

			}

		},

		dumpReqRsp: function (url) {
			return function (response) {
				console.log("\n\nurl:", url);
				console.log(response);
				return response;
			}
		},

		checkStatus: function (response) {

			if (response.status < 400) {

				return response;

			} else {

				let error = new Error(`${ response.status } (${ response.statusText })`);

				// extract any error response and pass along to error handler
				return response.json()
				.then(
					rsp => {
						if (rsp.message) error = new Error(`${ response.status } (${ response.statusText }): ${ rsp.message }`);
						error.response = rsp;
						throw error;
					},
					err => {
						throw error;
					}
				);

			}

		},

		parseJSON: function (response) {

			return response.json();

		},

		cacheResponse: function (key, value, isWrite) {

			console.log("response body:", JSON.stringify(value));

			this.cache[key] = {
				value,
				time: performance.now()
			};
			delete this.errorCache[key];

			// Delete any previous GET requests to the same URL
			// if we just wrote to that endpoint.
			if (isWrite) {
				let getRequestCacheKey = key.split(this.CACHE_KEY_URL_OPTIONS_DELIMITER)[0];
				delete this.cache[getRequestCacheKey];
				delete this.errorCache[getRequestCacheKey];
			}

			return value;

		},

		cacheError: function (key, error) {

			if (!this.errorCache[key]) {
				this.errorCache[key] = [];
			}

			let errors = this.errorCache[key];
			errors.push(error);

			return errors.length;

		},

		deriveCacheKey: function (url, requestOptions) {

			let optionsAsKey = [
					requestOptions.method,
					requestOptions.body
				].reduce((acc, o) => {

					// stringify and slugify select requestOptions
					if (o) acc += (
						JSON.stringify(o,
							(k, v) => typeof v === 'string' ? v.slice(0, 40) : v
						)
						.replace(/["{}]/g, '')		// remove quotes and braces
						.replace(/[:;,.\s]/g, '-')	// replace various punctuation with dashes
						+ '-');						// dash delimiters between request options
					return acc;
				}, '');

			if (optionsAsKey) {
				return url + this.CACHE_KEY_URL_OPTIONS_DELIMITER + optionsAsKey;
			} else {
				return url;
			}

		}

	};

};
