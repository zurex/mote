import { addMonths } from 'date-fns';
import HyperExpress from 'hyper-express';
import { GenerateOneTimePasswordRequest, LoginWithOneTimePasswordResponse } from '@mote/platform/request/common/request';
import { ServerServices } from 'mote/serverService.js';
import { ILogService } from '@mote/platform/log/common/log';
import { RedisAdapter } from '@mote/platform/storage/common/redis';
import { MagicLinkEmail } from 'mote/email/template/magicLinkEmail.js';
import { accountProvisioner } from 'mote/commands/accountProvisioner.js';
import { generateJwtToken } from 'mote/common/jwt.js';

const providerName = 'magiclink';
const router = new HyperExpress.Router();
const logService = ServerServices.get(ILogService);

router.post('/one-time-password', async (request, response) => {
    const payload: GenerateOneTimePasswordRequest = await request.json();
    const confirmationCode = Math.floor(100000 + Math.random() * 900000)
        .toString()
        .slice(0, 6);
    logService.info(`confirmationCode to user<email=${payload.email}>`, confirmationCode);

    // Save the confirmation code in Redis
    await RedisAdapter.defaultClient.set(
        generateOTPKey(payload.email),
        confirmationCode,
        'EX',
        10 * 60
    );

    // send email to users email address with a short-lived token
    await new MagicLinkEmail({
        to: payload.email,
        token: confirmationCode,
    }).send();

    response.json({ status: 'ok' });
});

router.get('/one-time-password', async (request, response) => {
    const params = request.query_parameters;
    const email = params['email'];
    const code = params['code'];

    const confirmationCode = await RedisAdapter.defaultClient.get(generateOTPKey(email));

    if (confirmationCode !== code) {
        logService.info(`Invalid code for user<email=${email}, otp=${confirmationCode}>`, code);
        return new Response('Invalid code', {
            status: 401,
        });
    }

    const { user, info } = await verifyUser({ email });
    const expires = addMonths(new Date(), 3);
    const token = generateJwtToken(user, expires);

    const data: LoginWithOneTimePasswordResponse = {
        token,
        user,
        // space: info.space,
        provider: {
            id: providerName,
            name: providerName,
            authUrl: ''
        }
    }

    response.json({ status: 'ok', data });
});

function generateOTPKey(user: string) {
    return `otp:${user}`;
}

async function verifyUser(user: GenerateOneTimePasswordRequest) {
    const name = user.email.split('@')[0];
    const result = await accountProvisioner({
        ip: '',
        user: {
            name,
            email: user.email,
        },
        authenticationProvider: {
            name: providerName,
            providerId: user.email,
        },
    });
    return { user: result.user, info: result };
}

export const authRouter = router;
