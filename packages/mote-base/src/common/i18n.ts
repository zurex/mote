/**
 * Converts a locale string from Unicode CLDR format to BCP47 format.
 *
 * @param locale The locale string to convert
 * @returns The converted locale string
 */
export function unicodeCLDRtoBCP47(locale: string) {
    return locale.replace('_', '-').replace('root', 'und');
}

/**
 * Converts a locale string from BCP47 format to Unicode CLDR format.
 *
 * @param locale The locale string to convert
 * @returns The converted locale string
 */
export function unicodeBCP47toCLDR(locale: string) {
    return locale.replace('-', '_').replace('und', 'root');
}

/**
 * Converts a locale string from Unicode CLDR format to ISO 639 format.
 *
 * @param locale The locale string to convert
 * @returns The converted locale string
 */
export function unicodeCLDRtoISO639(locale: string) {
    return locale.split('_')[0];
}

export const languageOptions = [
    {
        label: 'English (US)',
        value: 'en_US',
    },
    {
        label: 'Čeština (Czech)',
        value: 'cs_CZ',
    },
    {
        label: '简体中文 (Chinese, Simplified)',
        value: 'zh_CN',
    },
    {
        label: '繁體中文 (Chinese, Traditional)',
        value: 'zh_TW',
    },
    {
        label: 'Deutsch (German)',
        value: 'de_DE',
    },
    {
        label: 'Español (Spanish)',
        value: 'es_ES',
    },
    {
        label: 'Français (French)',
        value: 'fr_FR',
    },
    {
        label: 'Italiano (Italian)',
        value: 'it_IT',
    },
    {
        label: '日本語 (Japanese)',
        value: 'ja_JP',
    },
    {
        label: '한국어 (Korean)',
        value: 'ko_KR',
    },
    {
        label: 'Nederland (Dutch, Netherlands)',
        value: 'nl_NL',
    },
    {
        label: 'Norsk Bokmål (Norwegian)',
        value: 'nb_NO',
    },
    {
        label: 'Português (Portuguese, Brazil)',
        value: 'pt_BR',
    },
    {
        label: 'Português (Portuguese, Portugal)',
        value: 'pt_PT',
    },
    {
        label: 'Polskie (Polish)',
        value: 'pl_PL',
    },
    {
        label: 'فارسی (Persian)',
        value: 'fa_IR',
    },
    {
        label: 'Svenska (Swedish)',
        value: 'sv_SE',
    },
    {
        label: 'Türkçe (Turkish)',
        value: 'tr_TR',
    },
    {
        label: 'Українська (Ukrainian)',
        value: 'uk_UA',
    },
    {
        label: 'Tiếng Việt (Vietnamese)',
        value: 'vi_VN',
    },
];

export const languages = languageOptions.map((i) => i.value);
