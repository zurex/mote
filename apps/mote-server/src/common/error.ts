import httpErrors from 'http-errors';

export function AuthenticationError(
    message = 'Authentication required',
    redirectPath = '/'
) {
    return httpErrors(401, message, {
        redirectPath,
        id: 'authentication_required',
    });
}

export function InvalidAuthenticationError(
    message = 'Invalid authentication',
    redirectPath = '/'
) {
    return httpErrors(401, message, {
        redirectPath,
        id: 'invalid_authentication',
    });
}