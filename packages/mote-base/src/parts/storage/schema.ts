import { Prisma } from '@prisma/client';

export enum UserRole {
    Admin = 'admin',
    Member = 'member',
    Viewer = 'viewer',
    Guest = 'guest',
}

const user = Prisma.validator<Prisma.UserDefaultArgs>()({});

export type IUser = Prisma.UserGetPayload<typeof user>;

const authenticationProvider =
    Prisma.validator<Prisma.AuthenticationProviderWhereUniqueInput>()({});

export type IAuthenticationProvider = Prisma.AuthenticationProviderGetPayload<
    typeof authenticationProvider
>;

const memo = Prisma.validator<Prisma.MemoDefaultArgs>()({});

export type IMemo = Prisma.MemoGetPayload<typeof memo>;
 