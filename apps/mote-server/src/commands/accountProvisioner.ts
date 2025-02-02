import { IUser } from '@mote/base/parts/storage/schema.js';
import { AuthenticationProviderOptions, userProvisioner, UserProvisionerOptions } from './userProvisioner.js';

export type AccountProvisionerOptions = {
    /** The IP address of the incoming request */
    ip: string;
    /** Details of the user logging in from SSO provider */
    user: UserProvisionerOptions;
    /** Details of the workspace the user is logging into */
    //space: Omit<SpaceProvisionerOptions, 'user'>;
    /** Details of the authentication provider being used */
    authenticationProvider: AuthenticationProviderOptions;
};

export type AccountProvisionerResult = {
    user: IUser;
    // space: ISpace;
    // isNewSpace: boolean;
    isNewUser: boolean;
};

export async function accountProvisioner({
    ip,
    user: userOptions,
    // space: spaceOptions,
    authenticationProvider,
}: AccountProvisionerOptions): Promise<AccountProvisionerResult> {
    // Provision the user by creating or updating the user record
    const result = await userProvisioner({ ip, ...userOptions, authenticationProvider });

    const { isNewUser, user } = result;

    return { user, isNewUser };
}
