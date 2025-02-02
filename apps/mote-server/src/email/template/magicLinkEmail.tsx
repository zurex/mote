import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Img,
    Link,
    Preview,
    Section,
    Text,
} from '@react-email/components';
import { ReactNode } from 'react';
import { environment } from '@mote/platform/environment/common/environment';
import { useI18n } from '@mote/platform/i18n/common/i18n';
import BaseEmail, { EmailProps } from '../email.jsx';

type MagicLinkEmailProps = EmailProps & {
    token: string;
};

/**
 * Email sent to a user when they request a magic sign-in link.
 */
export class MagicLinkEmail extends BaseEmail<MagicLinkEmailProps, Record<string, any>> {
    protected subject() {
        return 'Your login code for Mote';
    }

    protected preview(): string {
        return `Here’s your link to signup to ${environment.APP_NAME}.`;
    }

    protected async render({ token }: MagicLinkEmailProps): Promise<ReactNode> {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const { t } = await useI18n();
        return (
            <Html>
                <Head />
                <Preview>Your login code for Mote</Preview>
                <Body style={main}>
                    <Container style={container}>
                        <Img
                            src={`${environment.URL}/static/linear-logo.png`}
                            width="42"
                            height="42"
                            alt="Linear"
                            style={logo}
                        />
                        <Heading style={heading}>Your login code for Linear</Heading>
                        <Section style={buttonContainer}>
                            <Button style={button} href={this.magicLink(token)}>
                                {t('Login to {{ authProviderName }}', {
                                    authProviderName: environment.APP_NAME,
                                })}
                            </Button>
                        </Section>
                        <Text style={paragraph}>
                            This link and code will only be valid for the next 10 minutes.
                            If the link does not work, you can use the login verification
                            code directly:
                        </Text>
                        <Section style={codeContainer}>
                            <Text style={code}>{token}</Text>
                        </Section>
                        <Hr style={hr} />
                        <Link href={environment.URL} style={reportLink}>
                            Mote
                        </Link>
                    </Container>
                </Body>
            </Html>
        );
    }

    private magicLink(token: string): string {
        return `${environment.URL}/auth/magiclink.callback?token=${token}`;
    }
}

const logo = {
    borderRadius: 21,
    width: 42,
    height: 42,
};

const main = {
    backgroundColor: '#ffffff',
    fontFamily:
        '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
    margin: '0 auto',
    padding: '20px 0 48px',
    maxWidth: '560px',
};

const heading = {
    fontSize: '24px',
    letterSpacing: '-0.5px',
    lineHeight: '1.3',
    fontWeight: '400',
    color: '#484848',
    padding: '17px 0 0',
};

const paragraph = {
    margin: '0 0 15px',
    fontSize: '15px',
    lineHeight: '1.4',
    color: '#3c4149',
};

const buttonContainer = {
    padding: '27px 0 27px',
};

const button = {
    backgroundColor: '#5e6ad2',
    borderRadius: '3px',
    fontWeight: '600',
    color: '#fff',
    fontSize: '15px',
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'block',
    padding: '11px 23px',
};

const reportLink = {
    fontSize: '14px',
    color: '#b4becc',
};

const hr = {
    borderColor: '#dfe1e4',
    margin: '42px 0 26px',
};

const codeContainer = {
    background: 'rgba(0,0,0,.05)',
    borderRadius: '4px',
    margin: '16px auto 14px',
    verticalAlign: 'middle',
    width: '280px',
};

const code = {
    color: '#000',
    display: 'inline-block',
    fontFamily: 'HelveticaNeue-Bold',
    fontSize: '32px',
    fontWeight: 700,
    letterSpacing: '6px',
    lineHeight: '40px',
    paddingBottom: '8px',
    paddingTop: '8px',
    margin: '0 auto',
    width: '100%',
    textAlign: 'center' as const,
};
