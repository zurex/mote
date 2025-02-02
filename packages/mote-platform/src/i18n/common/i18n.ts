import { type i18n, createInstance } from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { languages, unicodeCLDRtoBCP47 } from '@mote/base/common/i18n';

export interface I18N {
    i18n: i18n;
    resources: Record<string, any>;
    t: i18n['t'];
}

/**
 * Use i18n in server side, create new instance for each request.
 * @param defaultLanguage 
 * @returns 
 */
export async function useI18n(defaultLanguage = 'zh_CN'): Promise<I18N> {
    const lng = unicodeCLDRtoBCP47(defaultLanguage);

    const i18nInstance = createInstance();

    await i18nInstance
        .use(
            resourcesToBackend(
                (language: string, namespace: string) =>
                    import(`./locales/${language}/${namespace}.json`)
            )
        )
        .init({
            compatibilityJSON: 'v4',
            interpolation: {
                escapeValue: false,
            },
            lng,
            fallbackLng: lng,
            supportedLngs: languages.map(unicodeCLDRtoBCP47),
            keySeparator: false,
            returnNull: false,
        })
        .catch((err) => {
            console.error('Failed to initialize i18n', err);
        });

    return {
        i18n: i18nInstance,
        t: i18nInstance.t,
        resources: i18nInstance.services.resourceStore?.data,
    };
}
