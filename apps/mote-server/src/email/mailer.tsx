import { render } from '@react-email/render';
import addressparser from 'addressparser';
import {
    createTestAccount,
    createTransport,
    getTestMessageUrl,
    Transporter,
} from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { environment } from '@mote/platform/environment/common/environment';

const useTestEmailService = environment.isDevelopment && !environment.SMTP_USERNAME;

type SendMailOptions = {
    to: string;
    fromName?: string;
    replyTo?: string;
    subject: string;
    previewText?: string;
    component: JSX.Element;
    headCSS?: string;
    unsubscribeUrl?: string;
};

export class Mailer {
    transporter: Transporter | undefined;

    constructor() {
        if (environment.SMTP_HOST) {
            this.transporter = createTransport(this.getOptions());
        }
        if (useTestEmailService) {
            console.info('email', 'SMTP_USERNAME not provided, generating test account…');

            void this.getTestTransportOptions().then((options) => {
                if (!options) {
                    console.info(
                        'email',
                        "Couldn't generate a test account with ethereal.email at this time – emails will not be sent."
                    );
                    return;
                }

                this.transporter = createTransport(options);
            });
        }
    }

    sendMail = async (data: SendMailOptions): Promise<void> => {
        const { transporter } = this;

        if (!transporter) {
            return;
        }

        const html = await render(data.component);
        const text = await render(data.component, { plainText: true });

        const from = addressparser(environment.SMTP_FROM_EMAIL!)[0];

        const info = await transporter.sendMail({
            from: data.fromName
                ? {
                      name: data.fromName,
                      address: from.address,
                  }
                : environment.SMTP_FROM_EMAIL,
            replyTo:
                data.replyTo ??
                environment.SMTP_REPLY_EMAIL ??
                environment.SMTP_FROM_EMAIL,
            to: data.to,
            subject: data.subject,
            html,
            text,
            list: data.unsubscribeUrl
                ? {
                      unsubscribe: {
                          url: data.unsubscribeUrl,
                          comment: 'Unsubscribe from these emails',
                      },
                  }
                : undefined,
        });

        if (useTestEmailService) {
            console.info('email', `Preview Url: ${getTestMessageUrl(info)}`);
        }
    };

    private getOptions(): SMTPTransport.Options {
        return {
            name: environment.SMTP_NAME,
            host: environment.SMTP_HOST,
            port: environment.SMTP_PORT,
            secure: environment.SMTP_SECURE ?? environment.isProduction,
            auth: environment.SMTP_USERNAME
                ? {
                      user: environment.SMTP_USERNAME,
                      pass: environment.SMTP_PASSWORD,
                  }
                : undefined,
            tls: environment.SMTP_SECURE
                ? environment.SMTP_TLS_CIPHERS
                    ? {
                          ciphers: environment.SMTP_TLS_CIPHERS,
                      }
                    : undefined
                : {
                      rejectUnauthorized: false,
                  },
        };
    }

    private async getTestTransportOptions(): Promise<SMTPTransport.Options | undefined> {
        try {
            const testAccount = await createTestAccount();
            return {
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            };
        } catch (err) {
            return undefined;
        }
    }
}

export const mailer = new Mailer();
