import { prisma } from '@mote/base/parts/storage/prisma';
import { IAuthenticationProvider, IUser, UserRole } from '@mote/base/parts/storage/schema';

export type AuthenticationOptions = {
    authenticationProviderId: string;
    /** External identifier of the user in the authentication provider  */
    providerId: string | number;
    /** The scopes granted by the access token */
    scopes: string[];
    /** The token provided by the authentication provider */
    accessToken?: string;
    /** The refresh token provided by the authentication provider */
    refreshToken?: string;
    /** The timestamp when the access token expires */
    expiresAt?: Date;
};

export type AuthenticationProviderOptions = {
    /** The name of the authentication provider, eg "google" */
    name: string;
    /** External identifier of the authentication provider */
    providerId: string;
};

export type UserProvisionerOptions = {
    /** The displayed name of the user */
    name: string;
    /** The email address of the user */
    email: string;
    /** The public url of an image representing the user */
    avatarUrl?: string | null;
    /** The language of the user, if known */
    language?: string;
    userId?: string;
    /** The role for new user, Member if none is provided */
    role?: UserRole;
};

export type UserProvisionerResult = {
    user: IUser;
    isNewUser: boolean;
    authenticationProvider: IAuthenticationProvider | null;
};

export async function userProvisioner({
    name,
    email,
    language,
    avatarUrl,
    role,
    ip,
    authenticationProvider,
}: UserProvisionerOptions & {
    ip: string;
    authenticationProvider: AuthenticationProviderOptions;
}): Promise<UserProvisionerResult> {
    // Look up the authentication provider to see if it's enabled
    const authProvider = await prisma.authenticationProvider.findFirst({
        where: authenticationProvider,
        include: {
            user: true,
        },
    });

    if (authProvider) {
        return {
            user: authProvider.user,
            authenticationProvider: authProvider,
            isNewUser: false,
        };
    }

    // We cannot find an existing user, so we create a new one
    // No auth, no user – this is an entirely new sign in.

    const user = await prisma.user.create({
        data: {
            name,
            email,
            authenticationProviders: {
                create: {
                    ...authenticationProvider,
                },
            },
        },
        include: {
            authenticationProviders: true,
        },
    });

    return {
        user,
        authenticationProvider: user.authenticationProviders[0],
        isNewUser: true,
    };
}
