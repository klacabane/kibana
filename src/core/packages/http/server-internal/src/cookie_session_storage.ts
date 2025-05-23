/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { Request, Server, ServerStateCookieOptions } from '@hapi/hapi';
import hapiAuthCookie from '@hapi/cookie';

import type { Logger } from '@kbn/logging';
import type {
  KibanaRequest,
  SessionStorageFactory,
  SessionStorage,
  SessionStorageCookieOptions,
} from '@kbn/core-http-server';

import { isDeepStrictEqual } from 'util';

import { ensureRawRequest } from '@kbn/core-http-router-server-internal';

class ScopedCookieSessionStorage<T extends object> implements SessionStorage<T> {
  constructor(
    private readonly log: Logger,
    private readonly server: Server,
    private readonly request: Request
  ) {}

  public async get(): Promise<T | null> {
    try {
      const session = await this.server.auth.test('security-cookie', this.request);

      // A browser can send several cookies, if it's not an array, just return the session value
      if (!Array.isArray(session.credentials)) {
        return session.credentials as T;
      }

      // If we have an array with one value, we're good also
      if (session.credentials.length === 1) {
        return session.credentials[0] as T;
      }

      // If we have more than one session, return the first one if they are all the same
      if (session.credentials.length > 1) {
        this.log.warn(
          `Found multiple auth sessions. Found:[${session.credentials.length}] sessions. Checking equality...`
        );
        const [firstSession, ...rest] = session.credentials;
        const allEqual = rest.every((s) => {
          return isDeepStrictEqual(s, firstSession);
        });
        if (allEqual) {
          this.log.error(
            `Found multiple auth sessions. Found:[${session.credentials.length}] equal sessions`
          );
          return firstSession as T;
        }
      }

      // Otherwise, we have more than one session that are not the same as each other
      // and won't be authing the user because we don't know which session identifies
      // the actual user. There's potential to change this behavior to ensure all valid sessions
      // identify the same user, or choose one valid one, but this is the safest option.
      this.log.error(
        `Found multiple auth sessions. Found:[${session.credentials.length}] unequal sessions`
      );
      return null;
    } catch (error) {
      this.log.debug(String(error));
      return null;
    }
  }

  public set(sessionValue: T) {
    return this.request.cookieAuth.set(sessionValue);
  }

  public clear() {
    return this.request.cookieAuth.clear();
  }
}

function validateOptions(options: SessionStorageCookieOptions<any>) {
  if (options.sameSite === 'None' && options.isSecure !== true) {
    throw new Error('"SameSite: None" requires Secure connection');
  }
}

/**
 * Creates SessionStorage factory, which abstract the way of
 * session storage implementation and scoping to the incoming requests.
 *
 * @param server - hapi server to create SessionStorage for
 * @param cookieOptions - cookies configuration
 */
export async function createCookieSessionStorageFactory<T extends object>(
  log: Logger,
  server: Server,
  cookieOptions: SessionStorageCookieOptions<T>,
  disableEmbedding: boolean,
  basePath?: string
): Promise<SessionStorageFactory<T>> {
  validateOptions(cookieOptions);

  function clearInvalidCookie(req: Request | undefined, path: string = basePath || '/') {
    // if the cookie did not include the 'path' attribute in the session value, it is a legacy cookie
    // we will assume that the cookie was created with the current configuration
    log.debug('Clearing invalid session cookie');
    // need to use Hapi toolkit to clear cookie with defined options
    if (req) {
      (req.cookieAuth as any).h.unstate(cookieOptions.name, { path });
    }
  }

  await server.register({ plugin: hapiAuthCookie });

  server.auth.strategy('security-cookie', 'cookie', {
    cookie: {
      name: cookieOptions.name,
      password: cookieOptions.encryptionKey,
      isSecure: cookieOptions.isSecure,
      path: basePath === undefined ? '/' : basePath,
      clearInvalid: false,
      isHttpOnly: true,
      isSameSite: cookieOptions.sameSite ?? false,
      contextualize: (
        definition: Omit<ServerStateCookieOptions, 'isSameSite'> & { isSameSite: string }
      ) => {
        /**
         * This is a temporary solution to support the Partitioned attribute.
         * Statehood performs validation for the params, but only before the contextualize function call.
         * Since value for the isSameSite is used directly when making segment,
         * we can leverage that to append the Partitioned attribute to the cookie.
         *
         * Once statehood is updated to support the Partitioned attribute, we can remove this.
         * Issue: https://github.com/elastic/kibana/issues/188720
         */
        if (definition.isSameSite === 'None' && definition.isSecure && !disableEmbedding) {
          definition.isSameSite = 'None;Partitioned';
        }
      },
    },
    validate: async (req: Request, session: T | T[]) => {
      const result = cookieOptions.validate(session);
      if (!result.isValid) {
        clearInvalidCookie(req, result.path);
      }
      return { isValid: result.isValid };
    },
  });

  return {
    asScoped(request: KibanaRequest) {
      return new ScopedCookieSessionStorage<T>(log, server, ensureRawRequest(request));
    },
  };
}
