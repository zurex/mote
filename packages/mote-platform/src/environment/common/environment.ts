import { URI } from '@mote/base/common/uri';
import { IsEmail, IsIn, IsNotEmpty, IsNumber, IsOptional, IsUrl } from 'class-validator';

class Environment {
    /**
     * The current environment name.
     */
    @IsIn(['development', 'production', 'staging', 'test'])
    public ENVIRONMENT = process.env.NODE_ENV ?? 'production';

    public SECRET_KEY = process.env.SECRET_KEY!;

    /**
     * The url of redis. Note that redis does not have a database after the port.
     * Note: More extensive validation isn't included here due to our support for
     * base64-encoded configuration.
     */
    @IsNotEmpty()
    public REDIS_URL = process.env.REDIS_URL;

    public APP_NAME = process.env.NEXT_PUBLIC_APP_NAME!;

    /**
     * The url of the application. MUST have a prefix NEXT_PUBLIC_ to be exposed to the client.
     */
    public URL = process.env.NEXT_PUBLIC_URL!;

    /**
     * The port that the server will listen on, defaults to 3000.
     */
    @IsNumber()
    @IsOptional()
    public PORT = this.toOptionalNumber(process.env.PORT)!;

    //#region Database

    /**
     * An optional database schema.
     */
    @IsOptional()
    public DATABASE_SCHEMA = this.toOptionalString(process.env.DATABASE_SCHEMA);

    /**
     * Database connection pool configuration.
     */
    @IsNumber()
    @IsOptional()
    public DATABASE_CONNECTION_POOL_MIN = this.toOptionalNumber(
        process.env.DATABASE_CONNECTION_POOL_MIN
    );

    /**
     * Database connection pool configuration.
     */
    @IsNumber()
    @IsOptional()
    public DATABASE_CONNECTION_POOL_MAX = this.toOptionalNumber(
        process.env.DATABASE_CONNECTION_POOL_MAX
    );

    /**
     * The url of the database.
     */
    @IsNotEmpty()
    @IsUrl({
        require_tld: false,
        allow_underscores: true,
        protocols: ['postgres', 'postgresql'],
    })
    public DATABASE_URL = process.env.DATABASE_URL ?? '';

    /**
     * The url of the database pool.
     */
    @IsOptional()
    @IsUrl({
        require_tld: false,
        allow_underscores: true,
        protocols: ['postgres', 'postgresql'],
    })
    public DATABASE_CONNECTION_POOL_URL = this.toOptionalString(
        process.env.DATABASE_CONNECTION_POOL_URL
    );

    //#endregion

    /**
     * Returns true if the current installation is running in the development environment.
     */
    public get isDevelopment() {
        return this.ENVIRONMENT === 'development';
    }

    /**
     * Returns true if the current installation is running in production.
     */
    public get isProduction() {
        return this.ENVIRONMENT === 'production';
    }

    //#region SMTP

    /**
     * The username of your SMTP server, if any.
     */
    public SMTP_USERNAME = process.env.SMTP_USERNAME;

    public SMTP_HOST = process.env.SMTP_HOST;

    /**
     * The port of your SMTP server.
     */
    @IsNumber()
    @IsOptional()
    public SMTP_PORT = this.toOptionalNumber(process.env.SMTP_PORT);

    /**
     * If true (the default) the connection will use TLS when connecting to server.
     * If false then TLS is used only if server supports the STARTTLS extension.
     *
     * Setting secure to false therefore does not mean that you would not use an
     * encrypted connection.
     */
    public SMTP_SECURE = this.toBoolean(process.env.SMTP_SECURE ?? 'true');

    public SMTP_NAME = process.env.SMTP_NAME;

    public SMTP_PASSWORD = process.env.SMTP_PASSWORD;

    public SMTP_TLS_CIPHERS = this.toOptionalString(process.env.SMTP_TLS_CIPHERS);

    /**
     * The email address from which emails are sent.
     */
    @IsEmail({ allow_display_name: true, allow_ip_domain: true })
    @IsOptional()
    public SMTP_FROM_EMAIL = this.toOptionalString(process.env.SMTP_FROM_EMAIL);

    /**
     * The reply-to address for emails sent from Outline. If unset the from
     * address is used by default.
     */
    @IsEmail({ allow_display_name: true, allow_ip_domain: true })
    @IsOptional()
    public SMTP_REPLY_EMAIL = this.toOptionalString(process.env.SMTP_REPLY_EMAIL);

    //#endregion

    protected toOptionalString(value: string | undefined) {
        return value ? value : undefined;
    }

    protected toOptionalNumber(value: string | undefined) {
        return value ? parseInt(value, 10) : undefined;
    }

    /**
     * Convert a string to a boolean. Supports the following:
     *
     * 0 = false
     * 1 = true
     * "true" = true
     * "false" = false
     * "" = false
     *
     * @param value The string to convert
     * @returns A boolean
     */
    protected toBoolean(value: string) {
        try {
            return value ? !!JSON.parse(value) : false;
        } catch (err) {
            throw new Error(
                `"${value}" could not be parsed as a boolean, must be "true" or "false"`
            );
        }
    }
}

export const environment = new Environment();

/**
 * A basic environment service that can be used in various processes,
 * such as main, renderer and shared process. Use subclasses of this
 * service for specific environment.
 */
export interface IEnvironmentService {

	readonly _serviceBrand: undefined;

    //#region Logging

	logsHome: URI;
	logLevel?: string;
	extensionLogLevel?: [string, string][];
	verbose: boolean;
	isBuilt: boolean;

    //#endregion
}