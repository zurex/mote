import { ReactNode } from 'react';
import { mailer } from './mailer.js';

export type NotificationMetadata = {
    notificationId?: string;
};

export interface EmailProps {
    to: string | null;
}

export default abstract class BaseEmail<
    T extends EmailProps,
    S extends Record<string, any> | void = void,
> {
    private props: T;
    private metadata?: NotificationMetadata;

    constructor(props: T, metadata?: NotificationMetadata) {
        this.props = props;
        this.metadata = metadata;
    }

    //#region Properties

    /**
     * fromName hook allows overriding the "from" name of the email.
     */
    protected fromName?(props: T): string | undefined;

    /**
     * Returns the subject of the email.
     *
     * @param props Props in email constructor
     * @returns The email subject as a string
     */
    protected abstract subject(props: S & T): string;

    /**
     * Returns the preview text of the email, this is the text that will be shown
     * in email client list views.
     *
     * @param props Props in email constructor
     * @returns The preview text as a string
     */
    protected abstract preview(props: S & T): string;

    /**
     * Returns the unsubscribe URL for the email.
     *
     * @param props Props in email constructor
     * @returns The unsubscribe URL as a string
     */
    protected unsubscribeUrl?(props: T): string;

    /**
     * Allows injecting additional CSS into the head of the email.
     *
     * @param props Props in email constructor
     * @returns A string of CSS
     */
    protected headCSS?(props: T): string | undefined;

    private pixel(notification: any) {
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        return <img src={notification.pixelUrl} width="1" height="1" />;
    }

    //#endregion

    /**
     * Returns a React element that will be rendered on the server to produce the
     * HTML version of the email.
     *
     * @param props Props in email constructor
     * @returns A JSX element
     */
    protected abstract render(props: S & T): Promise<ReactNode>;

    /**
     * Send this email now.
     *
     * @returns A promise that resolves once the email has been successfully sent.
     */
    public async send() {
        const templateName = this.constructor.name;
        const bsResponse = await this.beforeSend?.(this.props);

        if (bsResponse === false) {
            console.info(
                'email',
                `Email ${templateName} not sent due to beforeSend hook`,
                this.props
            );
            return;
        }

        if (!this.props.to) {
            console.info(
                'email',
                `Email ${templateName} not sent due to missing email address`,
                this.props
            );
            return;
        }

        const data = { ...this.props, ...(bsResponse ?? ({} as S)) };
        const notification = this.metadata?.notificationId
            ? (null as any) // await Notification.findByPk(this.metadata?.notificationId)
            : undefined;

        if (notification?.viewedAt) {
            console.info(
                'email',
                `Email ${templateName} not sent as already viewed`,
                this.props
            );
            return;
        }

        // eslint-disable-next-line no-useless-catch
        try {
            const content = await this.render(data);
            await mailer.sendMail({
                to: this.props.to,
                fromName: this.fromName?.(data),
                subject: this.subject(data),
                previewText: this.preview(data),
                component: (
                    <>
                        {content}
                        {notification ? this.pixel(notification) : null}
                    </>
                ),
                headCSS: this.headCSS?.(data),
                unsubscribeUrl: this.unsubscribeUrl?.(data),
            });
        } catch (err) {
            throw err;
        }

        if (notification) {
            try {
                notification.emailedAt = new Date();
                await notification.save();
            } catch (err) {
                console.error(`Failed to update notification`, err, this.metadata);
            }
        }
    }

    /**
     * beforeSend hook allows async loading additional data that was not passed
     * through the serialized worker props. If false is returned then the email
     * send is aborted.
     *
     * @param props Props in email constructor
     * @returns A promise resolving to additional data
     */
    protected beforeSend?(props: T): Promise<S | false>;
}
