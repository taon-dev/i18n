import { LocalTranslationService } from './local-translation';

export async function startCli(
  argsv: string[],
  filename: string,
): Promise<void> {
  //#region @backendFunc
  const s = new LocalTranslationService();
  const result = await s.translate({
    from: 'en-US',
    to: 'de-DE',
    text: argsv.slice(2).join(' '),
  });
  console.log(`Translated: ${result}`);
  process.exit(0);
  //#endregion
}

export default startCli;
