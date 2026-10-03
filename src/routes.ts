/**
 * The client's route table, as VALUES rather than string literals scattered
 * through components.
 *
 * ADR-004 makes the routing configuration a reviewed artifact: a reviewer can
 * read the whole path vocabulary here without grepping the tree, and a change
 * to a path is a change to one line. `LoginRoute.POST_SIGN_IN_PATH` and
 * `RequireSession`'s redirect target are both derived from these constants, so
 * the two can never drift apart.
 */

/** The anonymous entry point. Resolves per session liveness -- see `Router`. */
export const ROOT_PATH = '/'

/** The sign-in screen. Also the destination of every guard denial. */
export const LOGIN_PATH = '/login'

/** The role-aware landing screen. Protected by `RequireSession`. */
export const WELCOME_PATH = '/welcome'
